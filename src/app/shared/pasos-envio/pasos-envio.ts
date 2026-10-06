import { Component, computed, input } from '@angular/core';
import { EMPRESAS, Pedido } from '../../core/services/orders';

const FECHA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });

// Línea de tiempo del pedido: Pago confirmado → Preparando → Enviado → Entregado
@Component({
  selector: 'app-pasos-envio',
  templateUrl: './pasos-envio.html',
  styleUrl: './pasos-envio.css',
})
export class PasosEnvio {
  pedido = input.required<Pedido>();

  pasos = computed(() => {
    const p = this.pedido();
    const orden = ['preparando', 'enviado', 'entregado'];
    const actual = p.envioEstado ? orden.indexOf(p.envioEstado) + 1 : 0;
    const f = (d: Date | null) => (d ? FECHA.format(d) : '');
    return [
      { titulo: 'Pago confirmado', detalle: f(p.pagadoEn ?? p.creadoEn) },
      { titulo: 'Preparando la obra', detalle: '' },
      { titulo: p.seguimiento?.empresa === 'mano' ? 'Lista para entregar' : 'Enviada', detalle: f(p.enviadoEn) },
      { titulo: 'Entregada', detalle: f(p.entregadoEn) }
    ].map((paso, i) => ({ ...paso, hecho: i < actual || (i === actual && actual === 3), actual: i === actual && actual < 3 }));
  });

  empresa = computed(() => {
    const s = this.pedido().seguimiento;
    return s ? EMPRESAS[s.empresa] : null;
  });
}
