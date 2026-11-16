import { Pipe, PipeTransform } from '@angular/core';

const CLOUDINARY_TRANSFORM_TOKEN_REGEX =
  /^(?:f|q|w|h|c|g|dpr|ar|e|r|bo|b|o|z|fl|t|x|y)_[a-zA-Z0-9.:_-]+$/;

/**
 * Normaliza cualquier URL de imagen de Cloudinary asegurando que cuente con
 * las transformaciones `f_auto,q_auto,w_800` después de `/upload/`.
 *
 * - Si la URL ya incluye `f_auto`, `q_auto` y `w_800`, la devuelve sin cambios.
 * - Si viene sin formato (ej. `.../upload/v1794834012/.../foto.jpg`), inserta `f_auto,q_auto,w_800`.
 * - Si trae transformaciones parciales, completa las que falten conservando el resto.
 */
export function formatCloudinaryImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();
  const uploadMarker = '/upload/';
  const uploadIdx = trimmed.indexOf(uploadMarker);

  if (uploadIdx === -1 || !trimmed.includes('cloudinary.com')) {
    return trimmed;
  }

  const prefix = trimmed.slice(0, uploadIdx + uploadMarker.length);
  const rest = trimmed.slice(uploadIdx + uploadMarker.length);
  if (!rest) {
    return trimmed;
  }

  const firstSlash = rest.indexOf('/');
  const firstSegment = firstSlash === -1 ? rest : rest.slice(0, firstSlash);
  const afterFirstSegment = firstSlash === -1 ? '' : rest.slice(firstSlash + 1);

  const tokens = firstSegment
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const isTransformSegment =
    firstSlash !== -1 &&
    tokens.length > 0 &&
    tokens.every((token) => CLOUDINARY_TRANSFORM_TOKEN_REGEX.test(token));

  if (isTransformSegment) {
    const hasFAuto = tokens.includes('f_auto');
    const hasQAuto = tokens.includes('q_auto');
    const hasW800 = tokens.includes('w_800');

    if (hasFAuto && hasQAuto && hasW800) {
      return trimmed;
    }

    const updatedTokens = [...tokens];
    if (!hasFAuto) {
      updatedTokens.unshift('f_auto');
    }
    if (!hasQAuto) {
      const fIdx = updatedTokens.indexOf('f_auto');
      updatedTokens.splice(fIdx + 1, 0, 'q_auto');
    }
    if (!hasW800) {
      const wIdx = updatedTokens.findIndex((t) => t.startsWith('w_'));
      if (wIdx !== -1) {
        updatedTokens[wIdx] = 'w_800';
      } else {
        const qIdx = updatedTokens.indexOf('q_auto');
        updatedTokens.splice(qIdx + 1, 0, 'w_800');
      }
    }

    return `${prefix}${updatedTokens.join(',')}/${afterFirstSegment}`;
  }

  return `${prefix}f_auto,q_auto,w_800/${rest}`;
}

@Pipe({
  name: 'cloudinaryImage',
  standalone: true,
})
export class CloudinaryImagePipe implements PipeTransform {
  transform(url?: string | null): string {
    return formatCloudinaryImageUrl(url);
  }
}
