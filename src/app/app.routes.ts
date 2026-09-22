import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';

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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./comprador/quiero-vender/quiero-vender').then(m => m.QuieroVender)
  },
  {
    path: 'checkout',
    canActivate: [authGuard, roleGuard],
    data: { role: 'comprador' },
    loadComponent: () =>
      import('./comprador/checkout/checkout').then(m => m.Checkout)
  },
  {
    path: 'mis-pedidos',
    canActivate: [authGuard, roleGuard],
    data: { role: 'comprador' },
    loadComponent: () =>
      import('./comprador/mis-pedidos/mis-pedidos').then(m => m.MisPedidos)
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { role: 'artista' },
    children: [
      { path: '', redirectTo: 'obras', pathMatch: 'full' },
      {
        path: 'obras',
        loadComponent: () =>
          import('./admin/mis-obras/mis-obras').then(m => m.MisObras)
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