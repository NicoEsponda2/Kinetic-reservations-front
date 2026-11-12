export type GeneroUsuario = 'M' | 'F' | 'O' | 'N';

export interface User {
  id_usuario: string;
  nombre: string;
  apellido?: string;
  email: string;
  roles: string[];
  fullName?: string;
  is_active?: boolean;
  telefono?: string;
  imagen?: string;
  fecha_nacimiento?: string;
  genero?: GeneroUsuario | string;
}
