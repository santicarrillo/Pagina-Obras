import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from '../core/services/auth';

// Solo deja pasar a quien ya activó su perfil de artista
export const artistaGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.esperarListo();
  if (auth.esArtista()) return true;

  return router.createUrlTree(['/vender']);
};

// Para la pantalla de alta: si ya es artista, no tiene sentido mostrarla
export const noArtistaGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.esperarListo();
  if (!auth.esArtista()) return true;

  return router.createUrlTree(['/admin/obras']);
};
