import { DecimalPipe, NgClass } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TableComponent,
  TableColumn,
  TableFilter,
} from '../../../components/table/table.component';
import { AdminService, AdminUser } from '@dashboard/services/admin.service';
import { AuthService } from '@auth/services/auth.service';
import { ToastrService } from 'ngx-toastr';

type UserRole = string;

interface User {
  id: string;
  id_usuario?: string;
  name: string;
  email: string;
  roles: UserRole[];
  role: string;
  status: 'Activo' | 'Inactivo';
  is_active: boolean;
  avatar: string;
  createdAt?: string;
  cantidadReservas: number;
  totalGastado: number;
}

interface Stats {
  newThisMonth: number;
  activeUsers: number;
  usersWithBookings: number;
  totalBookings: number;
  bookingParticipationRate: number;
  totalRevenueCLP: number;
  topSpenderName: string;
  topUsers: Array<{ name: string; avatar: string }>;
}

@Component({
  selector: 'app-users',
  imports: [NgClass, DecimalPipe, FormsModule, TableComponent],
  templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit {
  titulo: string = 'GESTIÓN DE USUARIOS';
  readonly defaultUserImage: string = '/assets/images/foto-usuario.jpg';
  private toastr = inject(ToastrService);
  private authService = inject(AuthService);
  adminService = inject(AdminService);

  modalAbierto: boolean = false;
  usuarioEditando: User | null = null;
  rolSeleccionado: string = 'Usuario';
  estadoSeleccionado: boolean = true;
  guardandoCambios: boolean = false;

  tableColumns: TableColumn[] = [
    { key: 'user', label: 'Usuario', isCustom: true },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Rol', isCustom: true },
    { key: 'status', label: 'Estado', isCustom: true },
    { key: 'modify', label: 'Modificar', isCustom: true },
  ];

  tableFilters: TableFilter[] = [
    {
      key: 'role',
      label: 'Rol (Todos)',
      value: '',
      options: [
        { value: 'SuperAdmin', label: 'SuperAdmin' },
        { value: 'Admin', label: 'Admin' },
        { value: 'Usuario', label: 'Usuario' },
      ],
    },
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
  pageSize: number = 10;
  totalUsers: number = 0;

  allUsers: User[] = [];
  paginatedUsers: User[] = [];
  currentFilteredUsers: User[] = [];
  cargando = true;

  stats: Stats = {
    newThisMonth: 0,
    activeUsers: 0,
    usersWithBookings: 0,
    totalBookings: 0,
    bookingParticipationRate: 0,
    totalRevenueCLP: 0,
    topSpenderName: 'Sin registros',
    topUsers: [],
  };

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.cargando = true;
    this.adminService.buscarUsuarios().subscribe({
      next: (resp) => {
        const users: AdminUser[] = resp.usuarios;
        this.allUsers = users.map((user, index) => {
          const roles = user.roles.map((role) => this.mapRole(role));
          const fullName = [user.nombre, user.apellido]
            .filter(Boolean)
            .join(' ')
            .trim();
          return {
            id: `#USR-${(index + 1).toString().padStart(4, '0')}`,
            id_usuario: user.id_usuario,
            name: fullName || user.nombre.trim(),
            email: user.email,
            roles,
            role: roles.join(', ') || 'Sin rol',
            status: this.mapStatus(user.is_active),
            is_active: Boolean(user.is_active),
            avatar: user.imagen?.trim() ? user.imagen : this.defaultUserImage,
            createdAt: user.created_at,
            cantidadReservas: Number(user.cantidad_reservas) || 0,
            totalGastado: Number(user.total_gastado) || 0,
          };
        });

        const roleFilter =
          this.tableFilters.find((f) => f.key === 'role')?.value || '';
        const statusFilter =
          this.tableFilters.find((f) => f.key === 'status')?.value || '';
        this.applyFilters(roleFilter, statusFilter);
        this.calculateStats();
        this.cargando = false;
      },
      error: (err) => {
        this.toastr.error(err);
        this.cargando = false;
      },
    });
  }

  private calculateStats(): void {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const newThisMonth = this.allUsers.filter((u) => {
      if (!u.createdAt) return false;
      const date = new Date(u.createdAt);
      return (
        !isNaN(date.getTime()) &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    }).length;

    const activeUsers = this.allUsers.filter((u) => u.is_active).length;

    const usersWithBookingsList = this.allUsers.filter(
      (u) => u.cantidadReservas > 0,
    );
    const usersWithBookings = usersWithBookingsList.length;

    const totalBookings = this.allUsers.reduce(
      (acc, u) => acc + u.cantidadReservas,
      0,
    );

    const bookingParticipationRate =
      this.allUsers.length > 0
        ? Math.round((usersWithBookings / this.allUsers.length) * 1000) / 10
        : 0;

    const totalRevenueCLP = this.allUsers.reduce(
      (acc, u) => acc + u.totalGastado,
      0,
    );

    const sortedBySpend = [...this.allUsers].sort(
      (a, b) =>
        b.totalGastado - a.totalGastado ||
        b.cantidadReservas - a.cantidadReservas,
    );

    const topSpender = sortedBySpend.find((u) => u.totalGastado > 0);

    this.stats = {
      newThisMonth,
      activeUsers,
      usersWithBookings,
      totalBookings,
      bookingParticipationRate,
      totalRevenueCLP,
      topSpenderName: topSpender ? topSpender.name : 'Sin reservas aún',
      topUsers: sortedBySpend.slice(0, 3).map((user) => ({
        name: user.name,
        avatar: user.avatar,
      })),
    };
  }

  mapRole(role: string): UserRole {
    switch (role.trim().toLowerCase()) {
      case 'superadmin':
      case 'super-user':
        return 'SuperAdmin';
      case 'admin':
        return 'Admin';
      case 'user':
      case 'usuario':
        return 'Usuario';
      default:
        return role.trim().charAt(0).toUpperCase() + role.trim().slice(1);
    }
  }

  mapStatus(isActive: boolean): 'Activo' | 'Inactivo' {
    return isActive ? 'Activo' : 'Inactivo';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getRoleClasses(role: string): string {
    switch (role.split(',')[0].trim()) {
      case 'SuperAdmin':
        return 'bg-error-container text-on-error-container';
      case 'Admin':
        return 'bg-secondary-container text-on-secondary-container';
      case 'Usuario':
        return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
      default:
        return 'bg-surface-container-high text-on-surface-variant';
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

  handleFilters(updatedFilters: TableFilter[]) {
    const roleFilter =
      updatedFilters.find((f) => f.key === 'role')?.value || '';
    const statusFilter =
      updatedFilters.find((f) => f.key === 'status')?.value || '';

    this.applyFilters(roleFilter, statusFilter);
  }

  handleClearFilters() {
    this.applyFilters('', '');
  }

  applyFilters(role: string = '', status: string = ''): void {
    let filtered = [...this.allUsers];

    if (role) {
      filtered = filtered.filter((user) => user.roles.includes(role));
    }

    if (status) {
      filtered = filtered.filter((user) => user.status === status);
    }

    this.currentFilteredUsers = filtered;
    this.totalUsers = filtered.length;
    this.currentPage = 1;

    this.updatePagination();
  }

  handlePageChange(page: number) {
    this.currentPage = page;
    this.updatePagination();
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedUsers = this.currentFilteredUsers.slice(
      startIndex,
      startIndex + this.pageSize,
    );
  }

  async exportData(): Promise<void> {
    const usersToExport = this.currentFilteredUsers;
    if (usersToExport.length === 0) {
      this.toastr.warning('No hay usuarios disponibles para exportar.');
      return;
    }

    const activosCount = usersToExport.filter(
      (u) => u.status === 'Activo',
    ).length;
    const adminsCount = usersToExport.filter((u) =>
      u.roles.some((r) => r.toLowerCase().includes('admin')),
    ).length;

    const { ExcelExportService } = await import(
      '../../services/excel-export.service'
    );
    const exported = new ExcelExportService().exportWorkbook({
      fileName: 'reporte-usuarios-kinetic',
      sheets: [
        {
          sheetName: 'Usuarios Registrados',
          title: 'Padrón de Usuarios y Roles del Sistema',
          subtitle: 'Control de cuentas, permisos y estados de actividad',
          data: usersToExport,
          columns: [
            {
              header: 'Nombre Completo',
              width: 210,
              value: (u) => u.name,
            },
            {
              header: 'Correo Electrónico',
              width: 240,
              value: (u) => u.email,
            },
            {
              header: 'Rol Asignado',
              width: 130,
              align: 'Center',
              value: (u) => u.role,
            },
            {
              header: 'Estado de Cuenta',
              width: 120,
              type: 'status',
              value: (u) => u.status,
            },
            {
              header: 'Cantidad de Reservas',
              width: 150,
              type: 'number',
              value: (u) => u.cantidadReservas,
            },
            {
              header: 'Monto Total Gastado (CLP)',
              width: 170,
              type: 'currency',
              value: (u) => u.totalGastado,
            },
          ],
          summaryRows: [
            {
              label: 'Total de Usuarios Exportados',
              value: usersToExport.length,
              type: 'number',
            },
            {
              label: 'Cuentas Activas',
              value: activosCount,
              type: 'number',
            },
            {
              label: 'Cuentas con Rol Administrador',
              value: adminsCount,
              type: 'number',
            },
          ],
        },
      ],
    });

    if (exported) {
      this.toastr.success(
        'Archivo Excel de Usuarios descargado exitosamente',
        'Exportación Completada',
      );
    }
  }

  addUser() {}

  handleRowAction(user: User) {}

  canModify(user: User): boolean {
    if (!this.authService.isAdmin()) {
      return false;
    }
    return user.roles.length === 1 && user.roles[0] === 'Usuario';
  }

  modifyUser(user: User): void {
    if (!this.canModify(user)) {
      this.toastr.warning(
        'No tienes permisos para modificar este usuario o se requiere rol de Admin.',
      );
      return;
    }

    this.usuarioEditando = user;
    this.rolSeleccionado = user.roles[0] || 'Usuario';
    this.estadoSeleccionado = user.status === 'Activo';
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    if (this.guardandoCambios) return;
    this.modalAbierto = false;
    this.usuarioEditando = null;
  }

  guardarCambiosUsuario(): void {
    if (!this.usuarioEditando) return;

    if (!this.authService.isAdmin()) {
      this.toastr.error('Debes tener rol de Admin para modificar usuarios.');
      return;
    }

    const idUsuario = this.usuarioEditando.id_usuario;
    if (!idUsuario) {
      this.toastr.error('No se encontró el identificador del usuario.');
      return;
    }

    const rolBackend =
      this.rolSeleccionado === 'Admin'
        ? 'admin'
        : this.rolSeleccionado === 'SuperAdmin'
          ? 'super-user'
          : 'user';

    this.guardandoCambios = true;

    this.adminService
      .actualizarUsuario(idUsuario, {
        roles: [rolBackend],
        is_active: this.estadoSeleccionado,
      })
      .subscribe({
        next: (resp) => {
          this.guardandoCambios = false;
          this.modalAbierto = false;
          this.usuarioEditando = null;
          this.toastr.success(
            resp.msg || 'Usuario actualizado correctamente',
            'Actualización Exitosa',
          );
          this.loadUsers();
        },
        error: (err) => {
          this.guardandoCambios = false;
          this.toastr.error(err);
        },
      });
  }
}
