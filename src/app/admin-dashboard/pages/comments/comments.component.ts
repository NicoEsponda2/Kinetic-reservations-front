import { NgClass } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
  TableComponent,
  TableColumn,
  TableFilter,
} from '../../../components/table/table.component';
import { AdminService } from '../../services/admin.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-admin-comments',
  imports: [NgClass, TableComponent],
  templateUrl: './comments.component.html',
})
export class CommentsComponent implements OnInit {
  titulo: string = 'GESTIÓN DE COMENTARIOS';

  private adminService = inject(AdminService);
  private toastr = inject(ToastrService);

  tableColumns: TableColumn[] = [
    { key: 'usuario', label: 'ID Usuario', isCustom: true },
    { key: 'comentario', label: 'Comentario (Resumen)', isCustom: true },
    { key: 'estado', label: 'Estado', isCustom: true },
    { key: 'acciones', label: 'Acción', isCustom: true },
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
  pageSize: number = 5;
  totalComments: number = 0;

  allComments: any[] = [];
  paginatedComments: any[] = [];
  currentFilteredComments: any[] = [];
  cargando = true;

  ngOnInit(): void {
    this.loadComments();
  }

  loadComments(): void {
    this.cargando = true;
    this.adminService.obtenerTodosLosComentarios().subscribe({
      next: (resp) => {
        this.allComments = resp.data || [];
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
    let filtered = [...this.allComments];

    if (status) {
      filtered = filtered.filter(
        (comment) => this.mapStatus(comment.is_active) === status,
      );
    }

    this.currentFilteredComments = filtered;
    this.totalComments = this.currentFilteredComments.length;
    this.currentPage = 1;
    this.updatePagination();
  }

  mapStatus(is_active: number): 'Activo' | 'Inactivo' {
    return is_active === 1 ? 'Activo' : 'Inactivo';
  }

  getStatusColor(status: string): string {
    return status === 'Activo' ? 'bg-primary-fixed' : 'bg-outline-variant';
  }

  getStatusTextClass(status: string): string {
    return status === 'Activo' ? 'text-on-surface' : 'text-on-surface-variant';
  }

  handlePageChange(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  updatePagination(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedComments = this.currentFilteredComments.slice(
      startIndex,
      startIndex + this.pageSize,
    );
  }

  truncate(text: string, max: number = 150): string {
    return text?.length > max ? text.slice(0, max) + '...' : (text ?? '');
  }

  toggleEstado(comentario: any): void {
    const nuevoEstado = comentario.is_active === 1 ? 0 : 1;

    this.adminService
      .cambiarEstadoComentario(comentario.id_comentario, nuevoEstado)
      .subscribe({
        next: () => {
          comentario.is_active = nuevoEstado;

          const currentFilter =
            this.tableFilters.find((f) => f.key === 'status')?.value || '';
          this.applyFilters(currentFilter);
        },
        error: (err) => this.toastr.error(err),
      });
  }

  async exportData(): Promise<void> {
    const commentsToExport = this.currentFilteredComments;
    if (commentsToExport.length === 0) {
      this.toastr.warning('No hay comentarios disponibles para exportar.');
      return;
    }

    const activosCount = commentsToExport.filter(
      (c) => this.mapStatus(c.is_active) === 'Activo',
    ).length;
    const inactivosCount = commentsToExport.length - activosCount;

    const { ExcelExportService } = await import(
      '../../services/excel-export.service'
    );
    const exported = new ExcelExportService().exportWorkbook({
      fileName: 'reporte-comentarios-comunidad',
      sheets: [
        {
          sheetName: 'Comentarios',
          title: 'Reporte de Reseñas y Comentarios de la Comunidad',
          subtitle: 'Evaluaciones registradas por los jugadores tras sus reservas',
          data: commentsToExport,
          columns: [
            {
              header: 'ID Comentario',
              width: 100,
              align: 'Center',
              value: (c) => `#${c.id_comentario}`,
            },
            {
              header: 'Jugador / Usuario',
              width: 180,
              value: (c) =>
                [c.nombre, c.apellido].filter(Boolean).join(' ') ||
                'Usuario',
            },
            {
              header: 'Deporte / Servicio',
              width: 140,
              value: (c) => c.deporte || 'General',
            },
            {
              header: 'Calificación (1-5)',
              width: 120,
              align: 'Center',
              value: (c) =>
                c.calificacion ? `${c.calificacion} / 5 ★` : 'Sin calificar',
            },
            {
              header: 'Comentario Completo',
              width: 360,
              value: (c) => c.comentario || '',
            },
            {
              header: 'Estado Visibilidad',
              width: 120,
              type: 'status',
              value: (c) => this.mapStatus(c.is_active),
            },
          ],
          summaryRows: [
            {
              label: 'Total de Comentarios Exportados',
              value: commentsToExport.length,
              type: 'number',
            },
            {
              label: 'Comentarios Visibles (Activos)',
              value: activosCount,
              type: 'number',
            },
            {
              label: 'Comentarios Ocultos (Inactivos)',
              value: inactivosCount,
              type: 'number',
            },
          ],
        },
      ],
    });

    if (exported) {
      this.toastr.success(
        'Archivo Excel de Comentarios descargado exitosamente',
        'Exportación Completada',
      );
    }
  }
}
