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
import { RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { GlobalService } from '@user-front/services/global.service';
import { Comentarios } from '@user-front/interfaces/services';
import { CachedImgDirective } from '@shared/directives/cached-img.directive';

@Component({
  selector: 'app-comments',
  imports: [RouterLink, CachedImgDirective],
  templateUrl: './comments.component.html',
  styleUrl: './comments.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('commentsTrack', { static: false })
  private commentsTrack?: ElementRef<HTMLElement>;

  @Input() titulo = 'Comentarios';
  @Input() descripcion =
    'Conoce la experiencia de nuestra comunidad deportiva en cada una de nuestras canchas e instalaciones.';

  private readonly toastr = inject(ToastrService);
  private readonly comentariosService = inject(GlobalService);
  private readonly ngZone = inject(NgZone);

  readonly comentarios = signal<Comentarios[]>([]);
  readonly canPrev = signal<boolean>(false);
  readonly canNext = signal<boolean>(false);

  private resizeObserver?: ResizeObserver;
  private readonly onScrollBound = () => this.updateNavState();

  ngOnInit(): void {
    this.comentariosService.obtenerComentariosInicio().subscribe({
      next: (data) => {
        this.comentarios.set(data ?? []);
        requestAnimationFrame(() => this.updateNavState());
      },
      error: (err) => this.toastr.error(err),
    });
  }

  ngAfterViewInit(): void {
    const track = this.commentsTrack?.nativeElement;
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
    const track = this.commentsTrack?.nativeElement;
    if (!track) return;

    const firstSlide = track.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(track).columnGap || '16') || 16;
    const step = firstSlide ? firstSlide.offsetWidth + gap : track.clientWidth;

    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  private updateNavState(): void {
    const track = this.commentsTrack?.nativeElement;
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
    this.commentsTrack?.nativeElement.removeEventListener(
      'scroll',
      this.onScrollBound,
    );
    this.resizeObserver?.disconnect();
  }
}
