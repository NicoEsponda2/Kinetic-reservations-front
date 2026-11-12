import { Routes } from '@angular/router';
import { UserFrontLayoutComponent } from './layouts/user-front-layout.component';

export const storeFrontRoutes: Routes = [
  {
    path: '',
    component: UserFrontLayoutComponent,
  },

  {
    path: '**',
    redirectTo: '',
  },
];

export default storeFrontRoutes;
