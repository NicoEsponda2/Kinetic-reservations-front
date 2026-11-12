import { Routes } from '@angular/router';
import { IsAdminGuard } from '@auth/guards/is-admin.guard';
import { IsAuthenticatedGuard } from '@auth/guards/is-authenticated.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes'),
    data: { preload: true },
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin-dashboard/admin-dashboard.routes'),
    canMatch: [IsAdminGuard],
  },
  {
    path: 'panel-usuario',
    loadChildren: () => import('./user-dashboard/user-dashboard.routes'),
    canMatch: [IsAuthenticatedGuard],
  },
  {
    path: '',
    loadChildren: () => import('./user-front/user-front.routes'),
    data: { preload: true },
  },
];
