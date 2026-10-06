import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPRESAS, EmpresaEnvio, Pedido, Pedidos } from '../../core/services/orders';
import { mensajeDeError } from '../../core/services/mercadopago';
import { PasosEnvio } from '../../shared/pasos-envio/pasos-envio';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});
const FECHA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

@Component({
  selector: 'app-mis-pagos',
  imports: [RouterLink, FormsModule, PasosEnvio],
  templateUrl: './mis-pagos.html',
  styleUrl: './mis-pagos.css',
})
export class MisPagos implements OnInit {
  private pedidos = inject(Pedidos);

  ventas = signal<Pedido[]>([]);
  cargando = signal(true);
  error = signal('');

  readonly empresas = Object.entries(EMPRESAS) as [EmpresaEnvio, { nombre: string }][];

  // Formulario de envío de cada venta, por id de pedido
  form: Record<string, { empresa: EmpresaEnvio | ''; codigo: string }> = {};
  guardandoEnvio = signal<string | null>(null);
  errorEnvio = signal<Record<string, string>>({});

  totalVendido = computed(() => this.ventas().reduce((s, v) => s + v.total, 0));

  async ngOnInit() {
    try {
      // Solo las ventas cobradas: las pendientes o rechazadas no le sirven al artista
      const todas = await this.pedidos.misVentas();
      const pagadas = todas.filter(v => v.estado === 'pagado');
      pagadas.forEach(v => (this.form[v.id] = { empresa: '', codigo: '' }));
      // Primero lo que falta despachar
      const orden = { preparando: 0, enviado: 1, entregado: 2 };
      this.ventas.set(pagadas.sort((a, b) => orden[a.envioEstado ?? 'preparando'] - orden[b.envioEstado ?? 'preparando']));
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

  pendientes = computed(() => this.ventas().filter(v => v.envioEstado === 'preparando').length);

  async marcarEnviado(v: Pedido) {
    const f = this.form[v.id];
    if (!f.empresa) return this.mostrarError(v.id, 'Elegí con qué empresa la mandaste.');
    if (f.empresa !== 'mano' && f.codigo.trim().length < 4) {
      return this.mostrarError(v.id, 'Poné el código de seguimiento que te dio la empresa.');
    }
    await this.actualizar(v, 'enviado', f.empresa, f.codigo.trim());
  }

  async marcarEntregado(v: Pedido) {
    if (!confirm('¿Confirmás que el comprador ya recibió la obra?')) return;
    await this.actualizar(v, 'entregado');
  }

  private async actualizar(v: Pedido, estado: 'enviado' | 'entregado', empresa?: EmpresaEnvio, codigo?: string) {
    this.guardandoEnvio.set(v.id);
    this.mostrarError(v.id, '');
    try {
      await this.pedidos.actualizarEnvio(v.id, estado, empresa, codigo);
      const ahora = new Date();
      this.ventas.update(lista => lista.map(x => x.id !== v.id ? x : {
        ...x,
        envioEstado: estado,
        seguimiento: estado === 'enviado' ? { empresa: empresa!, codigo: empresa === 'mano' ? '' : codigo! } : x.seguimiento,
        enviadoEn: estado === 'enviado' ? ahora : x.enviadoEn,
        entregadoEn: estado === 'entregado' ? ahora : x.entregadoEn
      }));
    } catch (e) {
      console.error(e);
      this.mostrarError(v.id, mensajeDeError(e, 'No se pudo guardar. Probá de nuevo.'));
    } finally {
      this.guardandoEnvio.set(null);
    }
  }

  private mostrarError(id: string, texto: string) {
    this.errorEnvio.update(e => ({ ...e, [id]: texto }));
  }
}
