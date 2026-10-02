import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Artworks, Obra } from '../../core/services/artworks';
import { OBRAS_DEMO } from '../../core/data/obras-demo';
import { Carrito } from '../../core/services/carrito';
import { Pagos } from '../../core/services/mercadopago';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});

@Component({
  selector: 'app-detalle-obra',
  imports: [RouterLink],
  templateUrl: './detalle-obra.html',
  styleUrl: './detalle-obra.css',
})
export class DetalleObra {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(Auth);
  private artworks = inject(Artworks);
  carrito = inject(Carrito);
  private pagos = inject(Pagos);
  // null = todavía no se sabe
  puedeCobrar = signal<boolean | null>(null);

  obra = signal<Obra | null>(null);
  error = signal('');
  borrando = signal(false);
  errorEliminar = signal('');

  constructor() {
    this.route.paramMap.subscribe(params => this.cargar(params.get('id') ?? ''));
  }

  private async cargar(id: string) {
    this.obra.set(null);
    this.puedeCobrar.set(null);
    this.error.set('');

    const demo = OBRAS_DEMO.find(o => o.id === id);
    if (demo) {
      this.obra.set(demo);
      this.puedeCobrar.set(true);
      return;
    }

    try {
      const obra = await this.artworks.obtener(id);
      if (!obra) {
        this.router.navigate(['/404'], { skipLocationChange: true });
        return;
      }
      this.obra.set(obra);
      this.puedeCobrar.set(await this.pagos.puedeCobrar(obra.artistId));
    } catch (e) {
      console.error(e);
      this.error.set('No pudimos cargar la obra. Revisá tu conexión y recargá la página.');
    }
  }

  precio(valor: number) {
    return PESOS.format(valor);
  }

  get esMia() {
    return this.obra()?.artistId === this.auth.usuario()?.uid;
  }

  agregarAlCarrito() {
    const o = this.obra();
    if (o) this.carrito.agregar(o);
  }

  async eliminar() {
    const o = this.obra();
    if (!o || !confirm(`¿Eliminar "${o.titulo}"? Esto no se puede deshacer.`)) return;

    this.borrando.set(true);
    this.errorEliminar.set('');
    try {
      await this.artworks.eliminar(o.id);
      this.router.navigate(['/admin/obras']);
    } catch (e) {
      console.error(e);
      this.errorEliminar.set('No se pudo eliminar la obra. Probá de nuevo.');
      this.borrando.set(false);
    }
  }
}