import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { AuthService } from '@auth/services/auth.service';

@Component({
  selector: 'front-navbar',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FrontNavbarComponent implements AfterViewInit, OnDestroy {
  private static readonly SECTION_IDS = [
    'inicio',
    'deportes',
    'comentarios',
  ] as const;

  readonly authService = inject(AuthService);
  private readonly ngZone = inject(NgZone);

  readonly menuOpen = signal<boolean>(false);
  readonly activeSection = signal<string>('inicio');
  readonly isNavbarHidden = signal<boolean>(false);
  readonly isScrollingUp = signal<boolean>(false);

  private lastScrollTop = 0;
  private scrollTicking = false;
  private observer: IntersectionObserver | null = null;
  private readonly sectionRatios = new Map<string, number>();
  private readonly observedElements = new Set<string>();

  private readonly onWindowScroll = () => {
    if (!this.scrollTicking) {
      this.scrollTicking = true;
      window.requestAnimationFrame(() => {
        this.updateScrollState();
        this.scrollTicking = false;
      });
    }
  };

  private updateScrollState() {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;

    if (currentScroll <= 10 && this.activeSection() !== 'inicio') {
      this.activeSection.set('inicio');
    }

    if (currentScroll > 50) {
      if (currentScroll > this.lastScrollTop) {
        if (!this.isNavbarHidden()) this.isNavbarHidden.set(true);
        if (this.isScrollingUp()) this.isScrollingUp.set(false);
        if (this.menuOpen()) this.menuOpen.set(false);
      } else {
        if (this.isNavbarHidden()) this.isNavbarHidden.set(false);
        if (!this.isScrollingUp()) this.isScrollingUp.set(true);
      }
    } else {
      if (this.isNavbarHidden()) this.isNavbarHidden.set(false);
      if (this.isScrollingUp()) this.isScrollingUp.set(false);
    }

    this.lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
    this.observeAvailableSections();
  }

  toggleMenu() {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(section?: string) {
    if (section) {
      this.activeSection.set(section);
    }
    this.menuOpen.set(false);
  }

  onMouseEnterTop() {
    this.isNavbarHidden.set(false);
  }

  onMouseLeaveHeader() {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;
    if (currentScroll > 50 && !this.isScrollingUp()) {
      this.isNavbarHidden.set(true);
    }
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onWindowScroll, { passive: true });

      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.target.id) {
              this.sectionRatios.set(
                entry.target.id,
                entry.isIntersecting ? entry.intersectionRatio : 0,
              );
            }
          }

          let mostVisibleSection: string | null = null;
          let maxVisibilityRatio = 0;

          this.sectionRatios.forEach((ratio, sectionId) => {
            if (ratio > maxVisibilityRatio) {
              maxVisibilityRatio = ratio;
              mostVisibleSection = sectionId;
            }
          });

          if (
            mostVisibleSection &&
            this.activeSection() !== mostVisibleSection
          ) {
            this.activeSection.set(mostVisibleSection);
          }
        },
        {
          threshold: [0, 0.15, 0.3, 0.5, 0.75, 1],
        },
      );

      this.observeAvailableSections();
    });
  }

  private observeAvailableSections() {
    if (this.observedElements.size >= FrontNavbarComponent.SECTION_IDS.length) {
      return;
    }

    for (const sectionId of FrontNavbarComponent.SECTION_IDS) {
      if (this.observedElements.has(sectionId)) continue;
      const element = document.getElementById(sectionId);
      if (element) {
        this.observer?.observe(element);
        this.observedElements.add(sectionId);
      }
    }
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.onWindowScroll);
    this.observer?.disconnect();
  }
}
