import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Artista, Artistas } from '../../core/services/artistas';
import { Obra } from '../../core/services/artworks';
import { TarjetaObra } from '../../shared/tarjeta-obra/tarjeta-obra';
import { nombreRed, textoRed } from '../../core/data/redes';

// Con menos obras que esto no se muestra el carrusel: repetiría la grilla
const MIN_PARA_CARRUSEL = 5;
const MAX_EN_CARRUSEL = 8;

@Component({
  selector: 'app-artista',
  imports: [TarjetaObra],
  templateUrl: './artista.html',
  styleUrl: './artista.css',
})
export class ArtistaPagina {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private artistas = inject(Artistas);

  artista = signal<Artista | null>(null);
  obras = signal<Obra[]>([]);
  cargando = signal(true);
  error = signal('');

  // Por ahora, las más nuevas. Cuando estén las destacadas (la estrellita), salen de ahí.
  carrusel = computed(() =>
    this.obras().length >= MIN_PARA_CARRUSEL ? this.obras().slice(0, MAX_EN_CARRUSEL) : []
  );

  tira = viewChild<ElementRef<HTMLElement>>('tira');
  puedeIzq = signal(false);
  puedeDer = signal(true);

  constructor() {
    this.route.paramMap.subscribe(p => this.cargar(p.get('id') ?? ''));
  }

  private async cargar(id: string) {
    this.cargando.set(true);
    this.error.set('');
    this.artista.set(null);
    this.obras.set([]);
    try {
      const artista = await this.artistas.obtener(id);
      if (!artista) {
        this.router.navigate(['/404'], { skipLocationChange: true });
        return;
      }
      this.artista.set(artista);
      this.obras.set(await this.artistas.obras(id));
      requestAnimationFrame(() => this.actualizarFlechas());
    } catch (e) {
      console.error(e);
      this.error.set('No pudimos cargar este artista. Recargá la página para intentar de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  mover(direccion: 1 | -1) {
    const el = this.tira()?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direccion * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  actualizarFlechas() {
    const el = this.tira()?.nativeElement;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    this.puedeIzq.set(el.scrollLeft > 4);
    this.puedeDer.set(el.scrollLeft < max - 4);
  }

  readonly nombreRed = nombreRed;
  readonly textoRed = textoRed;

  inicial(nombre: string) {
    return nombre.trim().charAt(0).toUpperCase();
  }
}