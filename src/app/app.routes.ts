import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { artistaGuard, noArtistaGuard } from './guards/artista-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./public/home/home').then(m => m.Home)
  },
  {
    path: 'obras',
    loadComponent: () =>
      import('./public/galeria/galeria').then(m => m.Galeria)
  },
  {
    path: 'obra/:id',
    loadComponent: () =>
      import('./public/detalle-obra/detalle-obra').then(m => m.DetalleObra)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./public/login/login').then(m => m.Login)
  },
  {
    path: 'vender',
    canActivate: [authGuard, noArtistaGuard],
    loadComponent: () =>
      import('./comprador/quiero-vender/quiero-vender').then(m => m.QuieroVender)
  },
  // Comprar y ver pedidos: cualquier usuario logueado (los artistas también compran)
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./comprador/checkout/checkout').then(m => m.Checkout)
  },
  {
    path: 'mis-pedidos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./comprador/mis-pedidos/mis-pedidos').then(m => m.MisPedidos)
  },
  // Panel del artista
  {
    path: 'admin',
    canActivate: [authGuard, artistaGuard],
    children: [
      { path: '', redirectTo: 'obras', pathMatch: 'full' },
      {
        path: 'obras',
        loadComponent: () =>
          import('./admin/mis-obras/mis-obras').then(m => m.MisObras)
      },
      {
        path: 'obras/nueva',
        loadComponent: () =>
          import('./admin/nueva-obra/nueva-obra').then(m => m.NuevaObra)
      },
      {
        path: 'pagos',
        loadComponent: () =>
          import('./admin/mis-pagos/mis-pagos').then(m => m.MisPagos)
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./admin/perfil/perfil').then(m => m.Perfil)
      }
    ]
  },
  { path: '404', loadComponent: () => import('./public/not-found/not-found').then(m => m.NotFound) },
  { path: '**', redirectTo: '404' }
];
