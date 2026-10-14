import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { Auth } from '../../core/services/auth';
import { Pagos, mensajeDeError } from '../../core/services/mercadopago';

// Si el artista la cierra, no vuelve a aparecer hasta la próxima visita
const CLAVE_CERRADA = 'anverso-franja-mp-cerrada';

// En "Mis obras" ya está el recorrido guiado: ahí la franja repetiría lo mismo
const RUTAS_SIN_FRANJA = ['/admin/obras', '/login'];

@Component({
  selector: 'app-franja-mp',
  templateUrl: './franja-mp.html',
  styleUrl: './franja-mp.css',
})
export class FranjaMp {
  private auth = inject(Auth);
  private pagos = inject(Pagos);
  private router = inject(Router);

  private conectado = signal<boolean | null>(null);
  private cerrada = signal(leerCerrada());
  conectando = signal(false);
  error = signal('');

  private url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  visible = computed(() => {
    if (!this.auth.esArtista() || this.cerrada() || this.conectado() !== false) return false;
    const ruta = this.url().split(/[?#]/)[0];
    return !RUTAS_SIN_FRANJA.some(r => ruta === r || ruta.startsWith(r + '/'));
  });

  constructor() {
    // Cada vez que cambia el usuario (entra, sale, se hace artista) se vuelve a consultar
    effect(() => {
      const uid = this.auth.usuario()?.uid;
      const artista = this.auth.esArtista();
      this.conectado.set(null);
      if (!uid || !artista) return;
      this.pagos.puedeCobrar(uid).then(ok => {
        if (this.auth.usuario()?.uid === uid) this.conectado.set(ok);
      });
    });
  }

  async conectar() {
    this.conectando.set(true);
    this.error.set('');
    try {
      await this.pagos.conectarMercadoPago();
    } catch (e) {
      console.error(e);
      this.error.set(mensajeDeError(e, 'No pudimos abrir Mercado Pago. Probá de nuevo en un rato.'));
      this.conectando.set(false);
    }
  }

  cerrar() {
    this.cerrada.set(true);
    try { sessionStorage.setItem(CLAVE_CERRADA, '1'); } catch { /* sin almacenamiento: se cierra solo por ahora */ }
  }
}

function leerCerrada(): boolean {
  try { return sessionStorage.getItem(CLAVE_CERRADA) === '1'; } catch { return false; }
}
