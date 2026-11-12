import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass, SlicePipe } from '@angular/common';
import {
  TableComponent,
  TableColumn,
} from '../../../components/table/table.component';
import { AdminService } from '../../services/admin.service';
import { ToastrService } from 'ngx-toastr';

export interface ReservaList {
  id_reserva: number;
  idCodigo: string;
  fecha: string;
  hora: string;
  canchaNombre: string;
  canchaTipo: string;
  colorCancha: string;
  usuarioNombre: string;
  usuarioAvatar: string;
  precio_cobrado: number;
  estado: string;
  estadoClass: string;
  estadoDotClass: string;
}

@Component({
  selector: 'app-bookings',
  imports: [NgClass, DatePipe, DecimalPipe, SlicePipe, TableComponent],
  templateUrl: './bookings.component.html',
})
export class BookingsComponent implements OnInit {
  titulo: string = 'LISTADO DE RESERVAS';

  totalReservasHoy: number = 0;
  ingresosHoy: number = 0;

  private adminService = inject(AdminService);
  private toastr = inject(ToastrService);

  tableColumns: TableColumn[] = [
    { key: 'idCodigo', label: 'ID', isCustom: true },
    { key: 'fechaHora', label: 'Fecha y Hora', isCustom: true },
    { key: 'instalacion', label: 'Instalación', isCustom: true },
    { key: 'usuario', label: 'Usuario', isCustom: true },
    { key: 'monto', label: 'Monto', isCustom: true },
    { key: 'estado', label: 'Estado', isCustom: true },
    { key: 'acciones', label: 'Acciones', isCustom: true },
  ];

  currentPage: number = 1;
  pageSize: number = 10;
  totalReservas: number = 0;

  listaReservasRaw: any[] = [];
  paginatedReservas: ReservaList[] = [];
  cargando = true;

  ngOnInit(): void {
    this.cargarReservasDesdeBackend();
  }

  cargarReservasDesdeBackend(): void {
    this.cargando = true;
    this.adminService.obtenerTodasLasReservas().subscribe({
      next: (resp) => {
        this.listaReservasRaw = resp.data || [];
        this.totalReservas = this.listaReservasRaw.length;
        this.calcularKPIs();
        this.updatePagination();
        this.cargando = false;
      },
      error: (err) => {
        this.toastr.error(err);
        this.listaReservasRaw = [];
        this.cargando = false;
      },
    });
  }

  calcularKPIs(): void {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    const fechaHoy = `${year}-${month}-${day}`;

    const reservasDeHoy = this.listaReservasRaw.filter(
      (res) => res.fecha === fechaHoy,
    );

    this.totalReservasHoy = reservasDeHoy.length;
    this.ingresosHoy = reservasDeHoy.reduce(
      (acc, curr) => acc + Number(curr.precio_cobrado),
      0,
    );
  }

  procesarDatosParaVista(datos: any[]): ReservaList[] {
    return datos.map((res) => {
      let estClass = 'bg-slate-200 text-slate-700';
      let estDot = 'bg-slate-400';

      if (res.estado === 'Pagada') {
        estClass = 'bg-[#59ee50] text-[#005406]';
        estDot = 'bg-[#006b0a]';
      } else if (res.estado === 'Cancelada') {
        estClass = 'bg-red-100 text-red-800';
        estDot = 'bg-red-600';
      } else if (res.estado === 'Completada') {
        estClass = 'bg-blue-100 text-blue-800';
        estDot = 'bg-blue-600';
      }

      let colorPista = 'bg-[#006b0a]';
      if (res.id_servicio === 2) colorPista = 'bg-[#0058bb]';
      if (res.id_servicio === 3) colorPista = 'bg-[#49e043]';

      return {
        id_reserva: res.id_reserva,
        idCodigo: `#${res.id_reserva}`,
        fecha: res.fecha,
        hora: res.hora_inicio,
        canchaNombre: res.pista,
        canchaTipo: res.servicio,
        colorCancha: colorPista,
        usuarioNombre: res.usuario_nombre,
        usuarioAvatar:
          res.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        precio_cobrado: res.precio_cobrado,
        estado: res.estado,
        estadoClass: estClass,
        estadoDotClass: estDot,
      };
    });
  }

  handlePageChange(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  updatePagination(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const porcionRaw = this.listaReservasRaw.slice(
      startIndex,
      startIndex + this.pageSize,
    );
    this.paginatedReservas = this.procesarDatosParaVista(porcionRaw);
  }

  async exportarDatos(): Promise<void> {
    const todasLasReservas = this.procesarDatosParaVista(this.listaReservasRaw);

    if (todasLasReservas.length === 0) {
      this.toastr.warning('No hay reservas registradas para exportar.');
      return;
    }

    const totalMonto = todasLasReservas.reduce(
      (acc, r) => acc + Number(r.precio_cobrado || 0),
      0,
    );
    const totalPagadas = todasLasReservas.filter(
      (r) => r.estado.toLowerCase() === 'pagada',
    ).length;

    const { ExcelExportService } = await import(
      '../../services/excel-export.service'
    );
    const exported = new ExcelExportService().exportWorkbook({
      fileName: 'reporte-reservas-estadio',
      sheets: [
        {
          sheetName: 'Listado de Reservas',
          title: 'Historial Completo de Reservas',
          subtitle: 'Registro consolidado de turnos y estados de pago',
          data: todasLasReservas,
          columns: [
            {
              header: 'ID Reserva',
              width: 90,
              align: 'Center',
              value: (r) => r.idCodigo,
            },
            {
              header: 'Fecha',
              width: 110,
              align: 'Center',
              value: (r) => r.fecha,
            },
            {
              header: 'Hora Inicio',
              width: 105,
              align: 'Center',
              value: (r) => `${(r.hora || '').slice(0, 5)} hrs`,
            },
            {
              header: 'Deporte / Servicio',
              width: 150,
              value: (r) => r.canchaTipo,
            },
            {
              header: 'Pista / Instalación',
              width: 190,
              value: (r) => r.canchaNombre,
            },
            {
              header: 'Jugador / Usuario',
              width: 190,
              value: (r) => r.usuarioNombre,
            },
            {
              header: 'Monto Cobrado (CLP)',
              width: 140,
              type: 'currency',
              value: (r) => r.precio_cobrado,
            },
            {
              header: 'Estado',
              width: 120,
              type: 'status',
              value: (r) => r.estado,
            },
          ],
          summaryRows: [
            {
              label: 'Total de Reservas Exportadas',
              value: todasLasReservas.length,
              type: 'number',
            },
            {
              label: 'Reservas con Pago Confirmado',
              value: totalPagadas,
              type: 'number',
            },
            {
              label: 'Monto Total Acumulado (CLP)',
              value: totalMonto,
              type: 'currency',
            },
          ],
        },
      ],
    });

    if (exported) {
      this.toastr.success(
        'Archivo Excel de Reservas descargado exitosamente',
        'Exportación Completada',
      );
    }
  }
}
