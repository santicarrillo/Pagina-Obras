import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Pedido {
  id: string;
  titulo: string;
  tecnica: string;
  precio: number;
  imagenUrl: string;
}

@Component({
  selector: 'app-mis-pedidos',
  imports: [RouterLink],
  templateUrl: './mis-pedidos.html',
  styleUrl: './mis-pedidos.css',
})
export class MisPedidos {
  pedidos = signal<Pedido[]>([
    {
      id: '1',
      titulo: 'Atardecer en el campo',
      tecnica: 'Óleo sobre lienzo',
      precio: 420000,
      imagenUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: '2',
      titulo: 'Retrato en azul',
      tecnica: 'Acrílico',
      precio: 320000,
      imagenUrl: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=1200&q=80',
    },
  ]);

  total = signal(0);

  constructor() {
    this.total.set(this.pedidos().reduce((sum, pedido) => sum + pedido.precio, 0));
  }
}
