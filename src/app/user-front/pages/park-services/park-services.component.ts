import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ServicesParkService } from '@user-front/services/service-park.service';
import { Servicio } from '@user-front/interfaces/services';
import { AuthService } from '@auth/services/auth.service';
import { CachedImgDirective } from '@shared/directives/cached-img.directive';

@Component({
  selector: 'app-park-services',
  imports: [DecimalPipe, CachedImgDirective],
  templateUrl: './park-services.component.html',
  styleUrl: './park-services.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParkServicesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('servicesTrack', { static: false })
  private servicesTrack?: ElementRef<HTMLElement>;

  @Input() cardWidth = 310;
  @Input() cardHeight = 380;

  readonly listServices = inject(ServicesParkService);
  readonly authService = inject(AuthService);
  private readonly ngZone = inject(NgZone);

  readonly servicios = signal<Servicio[]>([]);
  readonly canPrev = signal<boolean>(false);
  readonly canNext = signal<boolean>(false);

  private resizeObserver?: ResizeObserver;
  private readonly onScrollBound = () => this.updateNavState();

  ngOnInit(): void {
    this.listServices.obtenerServicios().subscribe((data) => {
      this.servicios.set(data ?? []);
      requestAnimationFrame(() => this.updateNavState());
    });
  }

  ngAfterViewInit(): void {
    const track = this.servicesTrack?.nativeElement;
    if (!track) return;

    this.ngZone.runOutsideAngular(() => {
      track.addEventListener('scroll', this.onScrollBound, { passive: true });

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.updateNavState());
        this.resizeObserver.observe(track);
      }
    });

    requestAnimationFrame(() => this.updateNavState());
  }

  scrollStep(direction: -1 | 1): void {
    const track = this.servicesTrack?.nativeElement;
    if (!track) return;

    const firstSlide = track.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(track).columnGap || '16') || 16;
    const step = firstSlide ? firstSlide.offsetWidth + gap : track.clientWidth;

    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  private updateNavState(): void {
    const track = this.servicesTrack?.nativeElement;
    if (!track) return;

    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    const nextCanPrev = track.scrollLeft > 4;
    const nextCanNext = maxScrollLeft - track.scrollLeft > 4;

    if (this.canPrev() !== nextCanPrev) {
      this.canPrev.set(nextCanPrev);
    }
    if (this.canNext() !== nextCanNext) {
      this.canNext.set(nextCanNext);
    }
  }

  ngOnDestroy(): void {
    this.servicesTrack?.nativeElement.removeEventListener(
      'scroll',
      this.onScrollBound,
    );
    this.resizeObserver?.disconnect();
  }
}
