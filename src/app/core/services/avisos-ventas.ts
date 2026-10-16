import { Injectable, effect, inject, signal } from '@angular/core';
import { Auth } from './auth';
import { Pedidos } from './orders';

// Cuántas ventas tiene el artista pagadas y sin despachar. Se actualiza solo,
// en vivo: aparece apenas alguien compra y baja cuando el artista marca el envío.
@Injectable({ providedIn: 'root' })
export class AvisosVentas {
  private auth = inject(Auth);
  private pedidos = inject(Pedidos);

  porDespachar = signal(0);
  private dejarDeEscuchar: (() => void) | null = null;

  constructor() {
    effect(() => {
      const uid = this.auth.usuario()?.uid;
      const esArtista = this.auth.esArtista();
      this.dejarDeEscuchar?.();
      this.dejarDeEscuchar = null;
      this.porDespachar.set(0);
      if (uid && esArtista) {
        this.dejarDeEscuchar = this.pedidos.escucharPorDespachar(uid, n => this.porDespachar.set(n));
      }
    });
  }
}
