import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AuthService } from '@auth/services/auth.service';
import { firstValueFrom } from 'rxjs';

export const IsAdminGuard: CanMatchFn = () => {
  const authService = inject(AuthService);

  if (authService.isSessionVerified()) {
    return authService.isAdmin();
  }

  return firstValueFrom(authService.checkStatus()).then(() =>
    authService.isAdmin(),
  );
};
