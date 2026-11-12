import { Injectable, computed, signal } from '@angular/core';

export type CookieCategory =
  | 'necessary'
  | 'preferences'
  | 'analytics'
  | 'marketing';

export type CookieModalTab = 'preferences' | 'policy';

export interface CookieConsentPreferences {
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentState extends CookieConsentPreferences {
  version: string;
  necessary: true;
  updatedAt: string;
  expiresAt: string;
}

const CONSENT_STORAGE_KEY = 'kr_cookie_consent_v1';
const CONSENT_COOKIE_NAME = 'kr_cookie_consent';
const CONSENT_VERSION = '1.0';
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 12 meses

const OPTIONAL_TRACKING_COOKIES: Record<
  Exclude<CookieCategory, 'necessary'>,
  string[]
> = {
  preferences: ['kr_ui_theme', 'kr_preferred_sport'],
  analytics: ['_ga', '_gid', '_gat', '_clck', '_clsk'],
  marketing: ['_fbp', '_fbc', '_gcl_au', '_uetsid', '_uetvid'],
};

@Injectable({
  providedIn: 'root',
})
export class CookieConsentService {
  private readonly _consentState = signal<CookieConsentState | null>(
    this.loadStoredConsent(),
  );
  private readonly _isModalOpen = signal<boolean>(false);
  private readonly _activeTab = signal<CookieModalTab>('preferences');

  readonly consentState = this._consentState.asReadonly();
  readonly isModalOpen = this._isModalOpen.asReadonly();
  readonly activeTab = this._activeTab.asReadonly();

  readonly hasDecided = computed(() => this._consentState() !== null);
  readonly isBannerVisible = computed(
    () => !this.hasDecided() && !this._isModalOpen(),
  );

  /**
   * Acepta todas las categorías de cookies (esenciales + opcionales).
   */
  acceptAll(): void {
    this.persistDecision({
      preferences: true,
      analytics: true,
      marketing: true,
    });
    this._isModalOpen.set(false);
  }

  /**
   * Rechaza todas las cookies no esenciales en un clic (Art. 12 Ley N° 21.719)
   * y elimina cualquier cookie opcional previamente almacenada.
   */
  rejectNonEssential(): void {
    this.persistDecision({
      preferences: false,
      analytics: false,
      marketing: false,
    });
    this._isModalOpen.set(false);
  }

  /**
   * Guarda la selección granular elegida por el usuario (Opt-in específico).
   */
  saveCustomPreferences(prefs: CookieConsentPreferences): void {
    this.persistDecision({
      preferences: Boolean(prefs.preferences),
      analytics: Boolean(prefs.analytics),
      marketing: Boolean(prefs.marketing),
    });
    this._isModalOpen.set(false);
  }

  /**
   * Abre el centro de privacidad/cookies en la pestaña solicitada.
   */
  openModal(tab: CookieModalTab = 'preferences'): void {
    this._activeTab.set(tab);
    this._isModalOpen.set(true);
  }

  setTab(tab: CookieModalTab): void {
    this._activeTab.set(tab);
  }

  closeModal(): void {
    this._isModalOpen.set(false);
  }

  /**
   * Permite consultar en cualquier servicio de la app si una categoría está autorizada
   * antes de inicializar scripts de terceros (ej. Google Analytics o píxeles).
   */
  isAllowed(category: CookieCategory): boolean {
    if (category === 'necessary') {
      return true;
    }
    const state = this._consentState();
    return state ? Boolean(state[category]) : false;
  }

  private persistDecision(prefs: CookieConsentPreferences): void {
    const now = new Date();
    const expires = new Date(now.getTime() + CONSENT_MAX_AGE_SECONDS * 1000);

    const newState: CookieConsentState = {
      version: CONSENT_VERSION,
      necessary: true,
      preferences: prefs.preferences,
      analytics: prefs.analytics,
      marketing: prefs.marketing,
      updatedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    this._consentState.set(newState);
    this.writeStorageAndCookie(newState);
    this.purgeDisallowedCookies(prefs);
  }

  private loadStoredConsent(): CookieConsentState | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return null;
    }

    try {
      const rawStorage = localStorage.getItem(CONSENT_STORAGE_KEY);
      const rawCookie = this.readBrowserCookie(CONSENT_COOKIE_NAME);
      const raw = rawStorage || rawCookie;

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
      if (
        !parsed ||
        parsed.version !== CONSENT_VERSION ||
        typeof parsed.preferences !== 'boolean' ||
        typeof parsed.analytics !== 'boolean' ||
        typeof parsed.marketing !== 'boolean' ||
        !parsed.expiresAt
      ) {
        return null;
      }

      if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
        this.clearStoredConsent();
        return null;
      }

      return {
        version: CONSENT_VERSION,
        necessary: true,
        preferences: parsed.preferences,
        analytics: parsed.analytics,
        marketing: parsed.marketing,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }

  private writeStorageAndCookie(state: CookieConsentState): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const serialized = JSON.stringify(state);

    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, serialized);
    } catch {
      // Ignorar si el almacenamiento local está restringido por el navegador
    }

    const encoded = encodeURIComponent(serialized);
    const secureAttr =
      window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${CONSENT_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secureAttr}`;
  }

  private clearStoredConsent(): void {
    try {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      // No-op
    }
    this.deleteBrowserCookie(CONSENT_COOKIE_NAME);
  }

  private purgeDisallowedCookies(prefs: CookieConsentPreferences): void {
    if (typeof document === 'undefined') {
      return;
    }

    const categories: Array<Exclude<CookieCategory, 'necessary'>> = [
      'preferences',
      'analytics',
      'marketing',
    ];

    for (const category of categories) {
      if (!prefs[category]) {
        for (const cookieName of OPTIONAL_TRACKING_COOKIES[category]) {
          this.deleteBrowserCookie(cookieName);
        }
      }
    }
  }

  private readBrowserCookie(name: string): string | null {
    const prefix = `${name}=`;
    const parts = document.cookie ? document.cookie.split('; ') : [];
    for (const part of parts) {
      if (part.startsWith(prefix)) {
        return decodeURIComponent(part.slice(prefix.length));
      }
    }
    return null;
  }

  private deleteBrowserCookie(name: string): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    const hostname = window.location.hostname;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    if (hostname && hostname !== 'localhost') {
      document.cookie = `${name}=; Path=/; Domain=.${hostname}; Max-Age=0; SameSite=Lax`;
    }
  }
}

