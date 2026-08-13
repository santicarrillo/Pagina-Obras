import  { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../core/services/auth';

export const roleGuard: CanActivateFn = async (route) => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.esperarListo();
  const rolRequerido = route.data['role'];

  if (auth.rol() === rolRequerido) return true;

  router.navigate(['/']);
  return false;
};