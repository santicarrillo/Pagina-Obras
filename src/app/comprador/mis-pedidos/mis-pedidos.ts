import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EstadoPedido, Pedido, Pedidos } from '../../core/services/orders';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});
const FECHA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

export const NOMBRES_ESTADO: Record<EstadoPedido, string> = {
  pendiente: 'Esperando el pago',
  pagado: 'Pagado',
  rechazado: 'Pago rechazado',
  reembolsado: 'Reembolsado',
  conflicto: 'Obra ya vendida — se te devuelve el dinero',
  error: 'No se pudo iniciar el pago'
};

@Component({
  selector: 'app-mis-pedidos',
  imports: [RouterLink],
  templateUrl: './mis-pedidos.html',
  styleUrl: './mis-pedidos.css',
})
export class MisPedidos implements OnInit {
  private pedidos = inject(Pedidos);
  private route = inject(ActivatedRoute);

  lista = signal<Pedido[]>([]);
  cargando = signal(true);
  error = signal('');
  aviso = signal('');

  readonly nombresEstado = NOMBRES_ESTADO;

  async ngOnInit() {
    const pago = this.route.snapshot.queryParamMap.get('pago');
    if (pago === 'ok') {
      this.aviso.set('¡Gracias por tu compra! Mercado Pago aprobó el pago. El artista se va a contactar con vos para coordinar el envío.');
    } else if (pago === 'pendiente') {
      this.aviso.set('Tu pago quedó pendiente. Cuando Mercado Pago lo apruebe, lo vas a ver acá como "Pagado".');
    }

    try {
      // Los pedidos que nunca se pagaron no se muestran, para no llenar la lista
      const todos = await this.pedidos.misCompras();
      this.lista.set(todos.filter(p => p.estado !== 'error' && !(p.estado === 'pendiente' && this.viejo(p))));
    } catch (e) {
      console.error(e);
      this.error.set('No pudimos cargar tus pedidos. Recargá la página para intentar de nuevo.');
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

  // Un pedido pendiente de hace más de un día es un pago que se abandonó
  private viejo(p: Pedido) {
    return !!p.creadoEn && Date.now() - p.creadoEn.getTime() > 24 * 3600 * 1000;
  }
}
