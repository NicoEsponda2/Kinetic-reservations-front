import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '@auth/services/auth.service';
import { firstValueFrom } from 'rxjs';

export const IsAuthenticatedGuard: CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isSessionVerified()) {
    return true;
  }

  return firstValueFrom(authService.checkStatus()).then((isAuthenticated) => {
    if (!isAuthenticated || authService.authStatus() !== 'authenticated') {
      router.navigateByUrl('/auth/login');
      return false;
    }
    return true;
  });
};
