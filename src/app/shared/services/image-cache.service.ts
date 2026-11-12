import { Injectable } from '@angular/core';

const IMAGE_CACHE_NAME = 'kr-cloudinary-images-v1';
const IMAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días de persistencia en disco
const CACHED_AT_HEADER = 'x-kr-cached-at';

@Injectable({
  providedIn: 'root',
})
export class ImageCacheService {
  private readonly objectUrlMemory = new Map<string, string>();
  private readonly inFlight = new Map<string, Promise<string>>();

  /**
   * Resuelve una URL de imagen desde RAM o desde el almacenamiento binario persistente
   * del navegador (CacheStorage API), evitando descargas o revalidaciones a Cloudinary en cada F5.
   */
  async resolveImageUrl(rawUrl: string | null | undefined): Promise<string> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return '';
    }

    const trimmed = rawUrl.trim();
    if (
      !trimmed ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('assets/')
    ) {
      return trimmed;
    }

    const normalizedUrl = this.optimizeCloudinaryUrl(trimmed);

    // 1. Nivel 1: Memoria RAM de la pestaña actual (0ms)
    const memHit = this.objectUrlMemory.get(normalizedUrl);
    if (memHit) {
      return memHit;
    }

    // 2. Deduplicación si la misma imagen ya se está resolviendo simultáneamente
    const existingPromise = this.inFlight.get(normalizedUrl);
    if (existingPromise) {
      return existingPromise;
    }

    const resolutionPromise = this.loadFromCacheStorageOrNetwork(
      normalizedUrl,
    ).finally(() => {
      this.inFlight.delete(normalizedUrl);
    });

    this.inFlight.set(normalizedUrl, resolutionPromise);
    return resolutionPromise;
  }

  /**
   * Optimiza automáticamente cualquier URL de Cloudinary inyectando f_auto,q_auto
   * si aún no cuenta con transformaciones de compresión.
   */
  optimizeCloudinaryUrl(url: string): string {
    if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
      return url;
    }

    if (url.includes('f_auto') || url.includes('q_auto')) {
      return url;
    }

    return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
  }

  private async loadFromCacheStorageOrNetwork(url: string): Promise<string> {
    if (typeof window === 'undefined' || !('caches' in window)) {
      return url;
    }

    try {
      const cache = await window.caches.open(IMAGE_CACHE_NAME);
      const cachedResponse = await cache.match(url);

      if (cachedResponse) {
        const cachedAtRaw = cachedResponse.headers.get(CACHED_AT_HEADER);
        const cachedAt = cachedAtRaw ? Number(cachedAtRaw) : Date.now();

        if (Date.now() - cachedAt <= IMAGE_TTL_MS) {
          const blob = await cachedResponse.blob();
          if (blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            this.objectUrlMemory.set(url, objectUrl);
            return objectUrl;
          }
        } else {
          await cache.delete(url);
        }
      }

      // Cache MISS en la primera visita: descargamos binario con CORS y lo persistimos en disco
      const networkResp = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'force-cache',
      });

      if (!networkResp.ok) {
        return url;
      }

      const blob = await networkResp.blob();
      if (blob.size === 0) {
        return url;
      }

      // Guardamos en CacheStorage con marca de tiempo para futuras recargas F5
      const headers = new Headers(networkResp.headers);
      headers.set(CACHED_AT_HEADER, String(Date.now()));
      const responseToStore = new Response(blob.slice(0), {
        status: 200,
        statusText: 'OK',
        headers,
      });

      await cache.put(url, responseToStore);

      const objectUrl = URL.createObjectURL(blob);
      this.objectUrlMemory.set(url, objectUrl);
      return objectUrl;
    } catch {
      // Si un servidor externo bloquea fetch CORS, usamos la URL directa sin romper la imagen
      return url;
    }
  }
}

