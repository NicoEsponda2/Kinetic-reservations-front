export interface HorarioBloque {
  dia_semana: number;
  hora_inicio: string;
  hora_termino: string;
  bloque_activo: boolean;
}

export interface Pista {
  id_pista: number | null;
  nombre: string;
  precio_hora: number;
  is_active: boolean;
}

export interface Servicio {
  id_deporte: string;
  nombre: string;
  descripcion: string;
  is_active: boolean;
  imagen_principal?: string;
  imagenes?: { id?: number; url: string }[] | string[];
  horarios?: HorarioBloque[];
  pistas?: Pista[];
  precio_desde?: number | null;
  calificacion?: number | null;
  total_comentarios?: number;
}

export interface Titulo {
  titulo: string;
  descripcion: string;
}

export interface ReservaServicio {
  id_servicio: string;
  nombre: string;
  imagen_principal?: string;
  pistas?: { id_pista: number; nombre: string; precio_hora: number }[];
}

export interface TransbankResponse {
  ok: boolean;
  url: string;
  token: string;
  msg?: string;
}

export interface Comentarios {
  deporte: string;
  titulo: string;
  calificacion: number;
  comentario: string;
  nombre: string;
  fecha: string;
  avatar?: string;
}
