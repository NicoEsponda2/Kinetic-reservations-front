import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { ImageCacheService } from '@shared/services/image-cache.service';

/**
 * Directiva para etiquetas <img [appCachedImg]="url">:
 * Intercepta la carga antes de asignar el atributo nativo `src`, sirviendo el binario
 * desde CacheStorage (window.caches) como ObjectURL local para evitar llamadas a Cloudinary en F5.
 */
@Directive({
  selector: 'img[appCachedImg]',
  standalone: true,
})
export class CachedImgDirective implements OnChanges {
  @Input('appCachedImg') sourceUrl: string | null | undefined;

  private readonly el = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private readonly imageCache = inject(ImageCacheService);
  private currentRequestVersion = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if ('sourceUrl' in changes) {
      this.applyCachedSource(this.sourceUrl);
    }
  }

  private async applyCachedSource(
    rawUrl: string | null | undefined,
  ): Promise<void> {
    const imgEl = this.el.nativeElement;
    imgEl.decoding = 'async';

    if (!rawUrl) {
      imgEl.removeAttribute('src');
      return;
    }

    const requestVersion = ++this.currentRequestVersion;
    const resolvedUrl = await this.imageCache.resolveImageUrl(rawUrl);

    if (requestVersion === this.currentRequestVersion && resolvedUrl) {
      imgEl.src = resolvedUrl;
    }
  }
}

