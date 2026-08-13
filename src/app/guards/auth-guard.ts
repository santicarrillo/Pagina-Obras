import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../core/services/auth';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.esperarListo();

  if (auth.estaLogueado()) return true;

  router.navigate(['/login']);
  return false;
};