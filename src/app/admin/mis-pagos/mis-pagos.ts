import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pedido, Pedidos } from '../../core/services/orders';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});
const FECHA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

@Component({
  selector: 'app-mis-pagos',
  imports: [RouterLink],
  templateUrl: './mis-pagos.html',
  styleUrl: './mis-pagos.css',
})
export class MisPagos implements OnInit {
  private pedidos = inject(Pedidos);

  ventas = signal<Pedido[]>([]);
  cargando = signal(true);
  error = signal('');

  totalVendido = computed(() => this.ventas().reduce((s, v) => s + v.total, 0));

  async ngOnInit() {
    try {
      // Solo las ventas cobradas: las pendientes o rechazadas no le sirven al artista
      const todas = await this.pedidos.misVentas();
      this.ventas.set(todas.filter(v => v.estado === 'pagado'));
    } catch (e) {
      console.error(e);
      this.error.set('No pudimos cargar tus ventas. Recargá la página para intentar de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  precio(valor: number) {
    return PESOS.format(valor);
  }

  fecha(d: Date | null) {
    return d ? FECHA.format(d) : '';
  }
}
