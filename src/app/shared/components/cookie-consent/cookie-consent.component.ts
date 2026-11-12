import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import {
  CookieConsentService,
  CookieModalTab,
} from '@shared/services/cookie-consent.service';

@Component({
  selector: 'app-cookie-consent',
  imports: [DatePipe],
  templateUrl: './cookie-consent.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookieConsentComponent {
  readonly cookieService = inject(CookieConsentService);
  private readonly toastr = inject(ToastrService);

  readonly draftPreferences = signal<boolean>(false);
  readonly draftAnalytics = signal<boolean>(false);
  readonly draftMarketing = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (this.cookieService.isModalOpen()) {
        const saved = this.cookieService.consentState();
        this.draftPreferences.set(saved ? saved.preferences : false);
        this.draftAnalytics.set(saved ? saved.analytics : false);
        this.draftMarketing.set(saved ? saved.marketing : false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.cookieService.isModalOpen()) {
      this.cookieService.closeModal();
    }
  }

  toggleDraft(category: 'preferences' | 'analytics' | 'marketing'): void {
    if (category === 'preferences') {
      this.draftPreferences.update((v) => !v);
    } else if (category === 'analytics') {
      this.draftAnalytics.update((v) => !v);
    } else {
      this.draftMarketing.update((v) => !v);
    }
  }

  selectTab(tab: CookieModalTab): void {
    this.cookieService.setTab(tab);
  }

  onAcceptAll(fromModal = false): void {
    this.cookieService.acceptAll();
    if (fromModal) {
      this.toastr.success('Preferencias de cookies actualizadas.');
    }
  }

  onRejectOptional(fromModal = false): void {
    this.cookieService.rejectNonEssential();
    if (fromModal) {
      this.toastr.info('Solo se mantendrán las cookies necesarias.');
    }
  }

  onSaveCustom(): void {
    this.cookieService.saveCustomPreferences({
      preferences: this.draftPreferences(),
      analytics: this.draftAnalytics(),
      marketing: this.draftMarketing(),
    });
    this.toastr.success('Tus preferencias de privacidad han sido guardadas.');
  }
}

