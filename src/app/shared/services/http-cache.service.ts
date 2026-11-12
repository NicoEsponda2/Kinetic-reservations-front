import { HttpContextToken, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Permite omitir explícitamente el caché en una petición puntual si fuera necesario:
 * http.get(url, { context: new HttpContext().set(SKIP_HTTP_CACHE, true) })
 */
export const SKIP_HTTP_CACHE = new HttpContextToken<boolean>(() => false);

interface CachedHttpEntry {
  body: unknown;
  expiresAt: number;
  createdAt: number;
  isAuthenticated: boolean;
}

interface CacheRule {
  pattern: string;
  ttlMs: number;
}

const STORAGE_PREFIX = 'kr_http_cache_v2:';
const MAX_STORAGE_ENTRIES = 60;

/**
 * Reglas de TTL (Time-To-Live) ordenadas de más específicas a más generales.
 * ttlMs = 0 significa "nunca cachear".
 */
const CACHE_RULES: readonly CacheRule[] = [
  // Pasarela de pagos: siempre en tiempo real
  { pattern: '/payment/', ttlMs: 0 },

  // Disponibilidad de horarios al reservar: TTL corto (15s) contra spam de F5 sin perder frescura
  { pattern: '/sports-schedules/get-available-times', ttlMs: 15_000 },

  // Configuración pública OAuth Google: 15 minutos
  { pattern: '/auth/google/config', ttlMs: 15 * 60_000 },

  // Catálogo público y Home Page: 5 minutos
  { pattern: '/sport/home', ttlMs: 5 * 60_000 },
  { pattern: '/sport/get-sports-names', ttlMs: 5 * 60_000 },
  { pattern: '/comments/home-page', ttlMs: 5 * 60_000 },

  // Renovación/verificación de sesión al recargar (F5): 2 minutos
  { pattern: '/auth/renew', ttlMs: 2 * 60_000 },

  // Paneles de Usuario y Administrador: 90 segundos
  { pattern: '/admin/dashboard', ttlMs: 90_000 },
  { pattern: '/sport/admin/find-sports', ttlMs: 2 * 60_000 },
  { pattern: '/sport/', ttlMs: 2 * 60_000 },
  { pattern: '/bookings/admin/bookings-history', ttlMs: 60_000 },
  { pattern: '/comments/admin/find-comments', ttlMs: 90_000 },
  { pattern: '/auth/admin/find-users', ttlMs: 90_000 },
  { pattern: '/user/get-dashboard-data/', ttlMs: 90_000 },
  { pattern: '/user/booking-history/', ttlMs: 90_000 },
  { pattern: '/user/get-comment/', ttlMs: 2 * 60_000 },
];

@Injectable({
  providedIn: 'root',
})
export class HttpCacheService {
  private readonly memoryCache = new Map<string, CachedHttpEntry>();
  private readonly inFlight = new Map<string, Observable<HttpEvent<unknown>>>();

  constructor() {
    this.pruneExpiredStorageEntries();
  }

  /**
   * Determina el tiempo de vida (TTL) en milisegundos para una URL dada.
   */
  resolveTtlMs(url: string): number {
    for (const rule of CACHE_RULES) {
      if (url.includes(rule.pattern)) {
        return rule.ttlMs;
      }
    }
    return 0;
  }

  /**
   * Genera una clave única aislando respuestas públicas de respuestas autenticadas por usuario.
   */
  buildKey(urlWithParams: string, authHeader: string | null): string {
    const scope = authHeader ? `auth:${this.hashString(authHeader)}` : 'public';
    return `${scope}|${urlWithParams}`;
  }

  /**
   * Obtiene una respuesta cacheada vigente desde RAM o sessionStorage (sobrevive a F5).
   */
  get(key: string): unknown | null {
    const now = Date.now();

    // 1. Revisión ultrarrápida en memoria RAM (navegación SPA)
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (memEntry.expiresAt > now) {
        return this.cloneSafe(memEntry.body);
      }
      this.memoryCache.delete(key);
      this.removeFromSessionStorage(key);
      return null;
    }

    // 2. Revisión persistente en sessionStorage (sobrevive a recargas F5)
    const storageEntry = this.readFromSessionStorage(key);
    if (!storageEntry) {
      return null;
    }

    if (storageEntry.expiresAt <= now) {
      this.removeFromSessionStorage(key);
      return null;
    }

    // Rehidratar en RAM para accesos subsiguientes en 0ms
    this.memoryCache.set(key, storageEntry);
    return this.cloneSafe(storageEntry.body);
  }

  /**
   * Almacena una respuesta HTTP tanto en RAM como en sessionStorage con su TTL.
   */
  set(
    key: string,
    body: unknown,
    ttlMs: number,
    isAuthenticated: boolean,
  ): void {
    if (ttlMs <= 0) {
      return;
    }

    const now = Date.now();
    const entry: CachedHttpEntry = {
      body: this.cloneSafe(body),
      createdAt: now,
      expiresAt: now + ttlMs,
      isAuthenticated,
    };

    this.memoryCache.set(key, entry);
    this.writeToSessionStorage(key, entry);
  }

  getInFlight(key: string): Observable<HttpEvent<unknown>> | undefined {
    return this.inFlight.get(key);
  }

  setInFlight(key: string, request$: Observable<HttpEvent<unknown>>): void {
    this.inFlight.set(key, request$);
  }

  deleteInFlight(key: string): void {
    this.inFlight.delete(key);
  }

  /**
   * Invalida todo el caché tras cualquier mutación (POST, PUT, PATCH, DELETE)
   * garantizando consistencia inmediata de datos.
   */
  invalidateAll(): void {
    this.memoryCache.clear();
    this.inFlight.clear();

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i);
        if (storageKey?.startsWith(STORAGE_PREFIX)) {
          keysToDelete.push(storageKey);
        }
      }
      for (const k of keysToDelete) {
        sessionStorage.removeItem(k);
      }
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }

  /**
   * Elimina únicamente las entradas asociadas a sesiones autenticadas (ej. al cerrar sesión).
   */
  invalidateAuthenticated(): void {
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.isAuthenticated || key.startsWith('auth:')) {
        this.memoryCache.delete(key);
      }
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i);
        if (storageKey?.startsWith(`${STORAGE_PREFIX}auth:`)) {
          keysToDelete.push(storageKey);
        }
      }
      for (const k of keysToDelete) {
        sessionStorage.removeItem(k);
      }
    } catch {
      // No-op
    }
  }

  private readFromSessionStorage(key: string): CachedHttpEntry | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as CachedHttpEntry;
      if (!parsed || typeof parsed.expiresAt !== 'number') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private writeToSessionStorage(key: string, entry: CachedHttpEntry): void {
    if (typeof window === 'undefined') {
      return;
    }

    const storageKey = STORAGE_PREFIX + key;
    const serialized = JSON.stringify(entry);

    try {
      this.enforceMaxStorageEntries();
      sessionStorage.setItem(storageKey, serialized);
    } catch {
      // Si se alcanza la cuota de sessionStorage, limpiamos entradas antiguas y reintentamos una vez
      this.pruneExpiredStorageEntries(true);
      try {
        sessionStorage.setItem(storageKey, serialized);
      } catch {
        // Si aún excede cuota, se mantiene igualmente en memoryCache
      }
    }
  }

  private removeFromSessionStorage(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // No-op
    }
  }

  private enforceMaxStorageEntries(): void {
    const cacheKeys: Array<{ storageKey: string; createdAt: number }> = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) {
        try {
          const parsed = JSON.parse(sessionStorage.getItem(k) || '{}');
          cacheKeys.push({
            storageKey: k,
            createdAt: Number(parsed?.createdAt) || 0,
          });
        } catch {
          cacheKeys.push({ storageKey: k, createdAt: 0 });
        }
      }
    }

    if (cacheKeys.length >= MAX_STORAGE_ENTRIES) {
      cacheKeys.sort((a, b) => a.createdAt - b.createdAt);
      const toRemove = cacheKeys.slice(
        0,
        cacheKeys.length - MAX_STORAGE_ENTRIES + 1,
      );
      for (const item of toRemove) {
        sessionStorage.removeItem(item.storageKey);
      }
    }
  }

  private pruneExpiredStorageEntries(evictHalfIfFull = false): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const now = Date.now();
      const validItems: Array<{ key: string; createdAt: number }> = [];
      const expiredKeys: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i);
        if (!storageKey?.startsWith(STORAGE_PREFIX)) {
          continue;
        }
        try {
          const parsed = JSON.parse(
            sessionStorage.getItem(storageKey) || '{}',
          ) as Partial<CachedHttpEntry>;
          if (!parsed.expiresAt || parsed.expiresAt <= now) {
            expiredKeys.push(storageKey);
          } else {
            validItems.push({
              key: storageKey,
              createdAt: parsed.createdAt || 0,
            });
          }
        } catch {
          expiredKeys.push(storageKey);
        }
      }

      for (const k of expiredKeys) {
        sessionStorage.removeItem(k);
      }

      if (evictHalfIfFull && validItems.length > 0) {
        validItems.sort((a, b) => a.createdAt - b.createdAt);
        const half = Math.ceil(validItems.length / 2);
        for (let i = 0; i < half; i++) {
          sessionStorage.removeItem(validItems[i].key);
        }
      }
    } catch {
      // No-op
    }
  }

  /**
   * Hash FNV-1a rápido de 32 bits para no guardar el JWT crudo dentro del nombre de la clave.
   */
  private hashString(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
  }

  private cloneSafe<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }
}

