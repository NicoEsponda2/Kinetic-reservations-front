import { User } from './user.interface';

export interface AuthResponse {
  usuario: User;
  token: string;
  isNewUser?: boolean;
}

export interface RegisterFormValues {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
}
