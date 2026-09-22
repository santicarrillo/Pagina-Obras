import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../core/services/auth';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.esperarListo();

  if (auth.estaLogueado()) return true;

  // Guarda a dónde quería ir para volver después del login
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};
