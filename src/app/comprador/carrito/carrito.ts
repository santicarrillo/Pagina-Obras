import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Carrito, ItemCarrito } from '../../core/services/carrito';
import { Auth } from '../../core/services/auth';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});

@Component({
  selector: 'app-carrito',
  imports: [RouterLink],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
})
export class CarritoPagina implements OnInit {
  carrito = inject(Carrito);
  private auth = inject(Auth);
  private router = inject(Router);

  revisando = signal(true);
  avisoPago = signal(false);

  // Cuántos artistas distintos hay en el carrito (cada uno envía su obra)
  artistas = computed(() => new Set(this.carrito.items().map(i => i.artistId)).size);

  async ngOnInit() {
    await this.carrito.revisar();
    this.revisando.set(false);
  }

  precio(valor: number) {
    return PESOS.format(valor);
  }

  quitar(item: ItemCarrito) {
    this.carrito.quitar(item.id);
  }

  pagar() {
    if (!this.auth.estaLogueado()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/carrito' } });
      return;
    }
    // Hasta que esté Mercado Pago
    this.avisoPago.set(true);
  }
}
