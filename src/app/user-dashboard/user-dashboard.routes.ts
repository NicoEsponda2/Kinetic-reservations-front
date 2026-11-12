import { Routes } from '@angular/router';
import { UserLayoutComponent } from './layouts/user-layout.component';

export const userDashRoutes: Routes = [
  {
    path: '',
    component: UserLayoutComponent,
    children: [
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
        path: 'confirmacion-reserva/retorno',
        loadComponent: () =>
          import('../components/confirm-booking/confirm-booking.component').then(
            (m) => m.ConfirmBookingComponent,
          ),
      },
      {
        path: 'reservas-usuario',
        loadComponent: () =>
          import('./pages/user-bookings/user-bookings.component').then(
            (m) => m.UserBookingsComponent,
          ),
      },
      {
        path: 'dashboard-usuario',
        loadComponent: () =>
          import('./pages/user-dashboard/user-dashboard.component').then(
            (m) => m.UserDashboardComponent,
          ),
      },
      {
        path: 'configuracion-perfil',
        loadComponent: () =>
          import('./pages/user-config/user-config.component').then(
            (m) => m.UserConfigComponent,
          ),
      },
      {
        path: 'comentarios-usuario',
        loadComponent: () =>
          import('./pages/user-commets/user-commets.component').then(
            (m) => m.UserCommetsComponent,
          ),
      },
      {
        path: '**',
        redirectTo: 'dashboard-usuario',
      },
    ],
  },
];

export default userDashRoutes;
