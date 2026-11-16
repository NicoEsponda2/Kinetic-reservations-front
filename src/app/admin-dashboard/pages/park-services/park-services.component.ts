import { NgClass } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  TableComponent,
  TableColumn,
  TableFilter,
} from '../../../components/table/table.component';
import { AdminService } from '@dashboard/services/admin.service';
import { Servicio } from '@user-front/interfaces/services';
import { ToastrService } from 'ngx-toastr';
import { CachedImgDirective } from '@shared/directives/cached-img.directive';
import { CloudinaryImagePipe } from '../../../pipes/cloudinary-image.pipe';

@Component({
  selector: 'app-park-services',
  imports: [NgClass, TableComponent, CachedImgDirective, CloudinaryImagePipe],
  templateUrl: './park-services.component.html',
})
export class ParkServicesComponent implements OnInit {
  titulo: string = 'GESTIÓN DE SERVICIOS';
  readonly defaultImage: string =
    'https://res.cloudinary.com/dhwoq5fdq/image/upload/f_auto,q_auto,w_800/v1791386286/KINETIC-RESERVATIONS/Static/faujurn3xy5ypgdmno6e.jpg';

  adminService = inject(AdminService);
  private router = inject(Router);
  private toastr = inject(ToastrService);

  tableColumns: TableColumn[] = [
    { key: 'servicio', label: 'Servicio', isCustom: true },
    { key: 'descripcion', label: 'Descripción', isCustom: true },
    { key: 'estado', label: 'Estado', isCustom: true },
    { key: 'acciones', label: 'Acciones', isCustom: true },
  ];

  tableFilters: TableFilter[] = [
    {
      key: 'status',
      label: 'Estado (Todos)',
      value: '',
      options: [
        { value: 'Activo', label: 'Activo' },
        { value: 'Inactivo', label: 'Inactivo' },
      ],
    },
  ];

  currentPage: number = 1;
  pageSize: number = 4;
  totalServices: number = 0;

  allServices: Servicio[] = [];
  paginatedServices: Servicio[] = [];
  currentFilteredServices: Servicio[] = [];
  cargando = true;

  Math = Math;

  ngOnInit(): void {
    this.loadServices();
  }

  loadServices(): void {
    this.cargando = true;
    this.adminService.obtenerServicios().subscribe({
      next: (data: Servicio[]) => {
        this.allServices = Array.isArray(data) ? data : [];
        this.applyFilters();
        this.cargando = false;
      },
      error: (err) => {
        this.toastr.error(err);
        this.cargando = false;
      },
    });
  }

  handleFilters(updatedFilters: TableFilter[]) {
    const statusFilter =
      updatedFilters.find((f) => f.key === 'status')?.value || '';
    this.applyFilters(statusFilter);
  }

  handleClearFilters() {
    this.applyFilters('');
  }

  applyFilters(status: string = ''): void {
    let filtered = [...this.allServices];

    if (status) {
      filtered = filtered.filter(
        (service) => this.mapStatus(service.is_active) === status,
      );
    }

    this.currentFilteredServices = filtered;
    this.totalServices = this.currentFilteredServices.length;
    this.currentPage = 1;
    this.updatePagination();
  }

  mapStatus(is_active: boolean): 'Activo' | 'Inactivo' {
    const normalized = Number(is_active);
    switch (normalized) {
      case 1:
        return 'Activo';
      case 2:
        return 'Inactivo';
      default:
        return 'Inactivo';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Activo':
        return 'bg-primary-fixed';
      case 'Inactivo':
        return 'bg-outline-variant';
      default:
        return 'bg-outline-variant';
    }
  }

  getStatusTextClass(status: string): string {
    switch (status) {
      case 'Activo':
        return 'text-on-surface';
      case 'Inactivo':
        return 'text-on-surface-variant';
      default:
        return 'text-on-surface-variant';
    }
  }

  handlePageChange(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  updatePagination(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedServices = this.currentFilteredServices.slice(
      startIndex,
      startIndex + this.pageSize,
    );
  }

  async exportData(): Promise<void> {
    const servicesToExport = this.currentFilteredServices;
    if (servicesToExport.length === 0) {
      this.toastr.warning('No hay servicios disponibles para exportar.');
      return;
    }

    const pistasplanas = servicesToExport.flatMap((srv) =>
      (srv.pistas || []).map((p) => ({
        servicio: srv.nombre,
        id_pista: p.id_pista,
        nombrePista: p.nombre,
        precioHora: Number(p.precio_hora) || 0,
        estado: p.is_active !== false ? 'Activo' : 'Inactivo',
      })),
    );

    const activosCount = servicesToExport.filter(
      (s) => this.mapStatus(s.is_active) === 'Activo',
    ).length;

    const { ExcelExportService } = await import(
      '../../services/excel-export.service'
    );
    const exported = new ExcelExportService().exportWorkbook({
      fileName: 'reporte-servicios-deportivos',
      sheets: [
        {
          sheetName: 'Servicios',
          title: 'Catálogo de Servicios Deportivos e Instalaciones',
          subtitle: 'Listado de disciplinas, disponibilidad y tarifas base',
          data: servicesToExport,
          columns: [
            {
              header: 'ID Servicio',
              width: 105,
              align: 'Center',
              value: (s) => `#${(s.id_deporte || '').split('-')[0]}`,
            },
            {
              header: 'Nombre del Servicio',
              width: 160,
              value: (s) => s.nombre,
            },
            {
              header: 'Descripción',
              width: 340,
              value: (s) => s.descripcion,
            },
            {
              header: 'N° de Pistas',
              width: 100,
              type: 'number',
              value: (s) => s.pistas?.length ?? 0,
            },
            {
              header: 'Tarifa Desde (CLP)',
              width: 135,
              type: 'currency',
              value: (s) => {
                if (s.precio_desde) return Number(s.precio_desde);
                const precios = (s.pistas || [])
                  .map((p: any) => Number(p.precio_hora))
                  .filter((n: any) => n > 0);
                return precios.length ? Math.min(...precios) : 0;
              },
            },
            {
              header: 'Estado',
              width: 110,
              type: 'status',
              value: (s) => this.mapStatus(s.is_active),
            },
          ],
          summaryRows: [
            {
              label: 'Total de Servicios Exportados',
              value: servicesToExport.length,
              type: 'number',
            },
            {
              label: 'Servicios Activos',
              value: activosCount,
              type: 'number',
            },
            {
              label: 'Total de Pistas Asociadas',
              value: pistasplanas.length,
              type: 'number',
            },
          ],
        },
        ...(pistasplanas.length > 0
          ? [
            {
              sheetName: 'Detalle de Pistas',
              title: 'Desglose de Pistas y Tarifas por Servicio',
              subtitle: ' Tarifas por hora y estado operativo de cada cancha',
              data: pistasplanas,
              columns: [
                {
                  header: 'ID Pista',
                  width: 90,
                  align: 'Center' as const,
                  value: (p: any) => `#${p.id_pista}`,
                },
                {
                  header: 'Servicio / Deporte',
                  width: 160,
                  value: (p: any) => p.servicio,
                },
                {
                  header: 'Nombre de la Pista',
                  width: 210,
                  value: (p: any) => p.nombrePista,
                },
                {
                  header: 'Precio por Hora (CLP)',
                  width: 150,
                  type: 'currency' as const,
                  value: (p: any) => p.precioHora,
                },
                {
                  header: 'Estado Operativo',
                  width: 120,
                  type: 'status' as const,
                  value: (p: any) => p.estado,
                },
              ],
            },
          ]
          : []),
      ],
    });

    if (exported) {
      this.toastr.success(
        'Archivo Excel de Servicios y Pistas descargado exitosamente',
        'Exportación Completada',
      );
    }
  }

  addService(): void {
    this.router.navigate(['/admin/nuevo-servicio']);
  }

  handleRowAction(servicio: Servicio): void { }

  truncate(text: string, max: number = 100): string {
    return text?.length > max ? text.slice(0, max - 3) + '...' : (text ?? '');
  }

  editService(servicio: Servicio): void {
    this.router.navigate(['/admin/editar-servicio', servicio.id_deporte], {
      state: { servicio },
    });
  }
}
