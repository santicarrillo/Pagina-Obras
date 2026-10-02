import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Carrito, ItemCarrito } from '../../core/services/carrito';
import { Auth } from '../../core/services/auth';
import { Pagos, mensajeDeError } from '../../core/services/mercadopago';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});

interface GrupoArtista {
  artistId: string;
  artistaNombre: string;
  items: ItemCarrito[];
  total: number;
}

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
  private route = inject(ActivatedRoute);
  private pagos = inject(Pagos);

  revisando = signal(true);
  pagando = signal<string | null>(null);   // artistId del grupo que se está pagando
  error = signal('');
  habilitados = signal<Record<string, boolean>>({});

  // Cada pago va a la cuenta de un solo artista, por eso se agrupa
  grupos = computed<GrupoArtista[]>(() => {
    const mapa = new Map<string, GrupoArtista>();
    for (const item of this.carrito.items()) {
      const g = mapa.get(item.artistId) ??
        { artistId: item.artistId, artistaNombre: item.artistaNombre, items: [], total: 0 };
      g.items.push(item);
      g.total += item.precio;
      mapa.set(item.artistId, g);
    }
    return [...mapa.values()];
  });

  async ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('pago') === 'error') {
      this.error.set('El pago no se completó. Tus obras siguen en el carrito, podés intentar de nuevo.');
    }
    await this.carrito.revisar();
    const estados: Record<string, boolean> = {};
    await Promise.all(this.grupos().map(async g => {
      estados[g.artistId] = await this.pagos.puedeCobrar(g.artistId);
    }));
    this.habilitados.set(estados);
    this.revisando.set(false);
  }

  precio(valor: number) {
    return PESOS.format(valor);
  }

  quitar(item: ItemCarrito) {
    this.carrito.quitar(item.id);
  }

  async pagar(grupo: GrupoArtista) {
    this.error.set('');
    if (!this.auth.estaLogueado()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/carrito' } });
      return;
    }
    if (grupo.artistId.startsWith('demo-')) {
      this.error.set('Las obras de prueba no se pueden pagar. Probá con una obra real.');
      return;
    }

    this.pagando.set(grupo.artistId);
    try {
      const url = await this.pagos.iniciarPago(grupo.items.map(i => i.id));
      // Se sacan del carrito: si el pago falla, Mercado Pago vuelve acá y se pueden agregar de nuevo
      grupo.items.forEach(i => this.carrito.quitar(i.id));
      window.location.href = url;
    } catch (e) {
      console.error(e);
      this.error.set(mensajeDeError(e, 'No pudimos iniciar el pago. Probá de nuevo en un rato.'));
      this.pagando.set(null);
      await this.carrito.revisar();
    }
  }
}
