import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Artworks, EstadoObra, Obra } from '../../core/services/artworks';
import { Auth } from '../../core/services/auth';
import { Pagos, mensajeDeError } from '../../core/services/mercadopago';

@Component({
  selector: 'app-mis-obras',
  imports: [RouterLink],
  templateUrl: './mis-obras.html',
  styleUrl: './mis-obras.css',
})
export class MisObras implements OnInit {
  private artworks = inject(Artworks);
  auth = inject(Auth);
  private pagos = inject(Pagos);
  private route = inject(ActivatedRoute);

  // Mercado Pago: null = cargando
  mpConectado = signal<boolean | null>(null);
  conectando = signal(false);
  avisoMp = signal('');
  errorMp = signal('');

  obras = signal<Obra[]>([]);
  cargando = signal(true);
  error = signal('');
  borrando = signal<string | null>(null);

  readonly nombresEstado: Record<EstadoObra, string> = {
    procesando: 'Revisando imagen',
    publicada: 'Publicada',
    rechazada: 'Rechazada',
    vendida: 'Vendida'
  };

  private formatoPesos = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  });

  precio(valor: number) {
    return this.formatoPesos.format(valor);
  }

  async ngOnInit() {
    this.revisarMercadoPago();
    try {
      this.obras.set(await this.artworks.misObras());
    } catch {
      this.error.set('No pudimos cargar tus obras. Recargá la página para intentar de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  async eliminar(obra: Obra) {
    if (!confirm(`¿Eliminar "${obra.titulo}"? Esto no se puede deshacer.`)) return;

    this.borrando.set(obra.id);
    try {
      await this.artworks.eliminar(obra.id);
      this.obras.update(lista => lista.filter(o => o.id !== obra.id));
    } catch {
      this.error.set(`No se pudo eliminar "${obra.titulo}".`);
    } finally {
      this.borrando.set(null);
    }
  }

  private async revisarMercadoPago() {
    const resultado = this.route.snapshot.queryParamMap.get('mp');
    const mensajes: Record<string, string> = {
      conectado: '¡Listo! Tu cuenta de Mercado Pago quedó conectada. Ya podés vender.',
      cancelado: 'Cancelaste la conexión con Mercado Pago. Podés intentarlo de nuevo cuando quieras.',
      vencido: 'El link para conectar Mercado Pago venció. Probá de nuevo.',
      error: 'No pudimos conectar tu cuenta de Mercado Pago. Probá de nuevo en un rato.'
    };
    if (resultado && mensajes[resultado]) {
      (resultado === 'conectado' ? this.avisoMp : this.errorMp).set(mensajes[resultado]);
    }
    const uid = this.auth.usuario()?.uid;
    this.mpConectado.set(uid ? await this.pagos.puedeCobrar(uid) : false);
  }

  async conectarMercadoPago() {
    this.conectando.set(true);
    this.errorMp.set('');
    try {
      await this.pagos.conectarMercadoPago();
    } catch (e) {
      console.error(e);
      this.errorMp.set(mensajeDeError(e, 'No pudimos abrir Mercado Pago. Probá de nuevo en un rato.'));
      this.conectando.set(false);
    }
  }
}
