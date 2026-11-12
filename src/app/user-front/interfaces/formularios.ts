export interface BookingForm {
  id_servicio: string | number;
  id_pista: number; // NUEVO: Ahora reservamos la pista exacta
  fecha: string;
  hora_inicio: string;
  hora_termino: string;
  monto: number; // NUEVO: Necesario para mandar a Transbank
  comentario?: string;
  id_usuario: string | number;
}

export interface postResponde {
  ok?: boolean;
  msg: string;
}



export interface Reserva {
  id_reserva: number;
  id_user: string;
  id_servicio: number;
  id_pista: number; // NUEVO: Reflejando la base de datos real
  fecha: string;
  hora_inicio: string;
  hora_termino: string;
  monto: number; // NUEVO
  comentario: string;
  createdAt: string;
  nombre_usuario: string;
  nombre_servicio: string;
  nombre_pista: string; // NUEVO
}