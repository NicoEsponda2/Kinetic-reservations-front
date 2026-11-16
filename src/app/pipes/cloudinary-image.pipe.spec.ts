import {
  CloudinaryImagePipe,
  formatCloudinaryImageUrl,
} from './cloudinary-image.pipe';

describe('CloudinaryImagePipe', () => {
  const pipe = new CloudinaryImagePipe();

  it('agrega f_auto,q_auto,w_800 cuando la URL de Cloudinary viene sin formato', () => {
    const raw =
      'https://res.cloudinary.com/dhwoq5fdq/image/upload/v1794834012/KINETIC-RESERVATIONS/servicios/foto.jpg';
    const expected =
      'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1794834012/KINETIC-RESERVATIONS/servicios/foto.jpg';

    expect(pipe.transform(raw)).toBe(expected);
  });

  it('deja la URL tal como está si ya contiene f_auto, q_auto y w_800', () => {
    const formatted =
      'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1792671371/KINETIC-RESERVATIONS/servicios/zjfxkopmsbfbvxda7xmj.jpg';

    expect(pipe.transform(formatted)).toBe(formatted);
  });

  it('completa w_800 cuando la URL solo trae f_auto,q_auto', () => {
    const partial =
      'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto/v1792671371/KINETIC-RESERVATIONS/servicios/foto.jpg';
    const expected =
      'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1792671371/KINETIC-RESERVATIONS/servicios/foto.jpg';

    expect(formatCloudinaryImageUrl(partial)).toBe(expected);
  });

  it('no modifica URLs que no pertenecen a Cloudinary ni rutas locales', () => {
    expect(pipe.transform('/assets/images/foto-usuario.jpg')).toBe(
      '/assets/images/foto-usuario.jpg',
    );
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
