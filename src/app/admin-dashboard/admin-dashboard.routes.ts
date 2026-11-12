import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layouts/admin-layout.component';

export const adminDashboardRoutes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'bookings',
        title: 'Reservas - Admin Dashboard',
        loadComponent: () =>
          import('./pages/bookings/bookings.component').then(
            (m) => m.BookingsComponent,
          ),
      },
      {
        path: 'comentarios',
        loadComponent: () =>
          import('./pages/comments/comments.component').then(
            (m) => m.CommentsComponent,
          ),
      },
      {
        path: 'nueva-reserva',
        loadComponent: () =>
          import('../components/new-booking/new-booking.component').then(
            (m) => m.NewBookingComponent,
          ),
      },
      {
        path: 'confirmacion-reserva',
        loadComponent: () =>
          import('../components/confirm-booking/confirm-booking.component').then(
            (m) => m.ConfirmBookingComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users/users.component').then(
            (m) => m.UsersComponent,
          ),
      },
      {
        path: 'servicios',
        loadComponent: () =>
          import('./pages/park-services/park-services.component').then(
            (m) => m.ParkServicesComponent,
          ),
      },
      {
        path: 'nuevo-servicio',
        loadComponent: () =>
          import('./pages/new-service/new-service.component').then(
            (m) => m.NewServiceComponent,
          ),
      },
      {
        path: 'editar-servicio/:id',
        loadComponent: () =>
          import('./pages/edit-service/edit-service.component').then(
            (m) => m.EditServiceComponent,
          ),
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];

export default adminDashboardRoutes;
