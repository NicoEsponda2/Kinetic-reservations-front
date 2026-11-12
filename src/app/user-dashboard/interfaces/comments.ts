export interface Pista {
  id_pista: number;
  nombre: string;
}

export interface Reserva {
  id_reserva: number;
  id_usuario: string;
  fecha_visita: string;
  hora_visita: string;
  hora_termino: string;
}

export interface ComentarioDetalle {
  id_comentario: number;
  id_usuario: string;
  nombre_servicio: string;
  imagen_servicio?: string;
  id_servicio: number | string;
  id_pista: number;
  fecha_visita: string;
  hora_visita: string;
  calificacion: number;
  comentario: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  pista: Pista;
  reserva: Reserva;
}

export interface ComentariosResponse {
  ok: boolean;
  comentarios: ComentarioDetalle[];
}
