import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Artworks, Obra } from '../../core/services/artworks';
import { Auth } from '../../core/services/auth';
import { OBRAS_DEMO } from '../../core/data/obras-demo';
import { TarjetaObra } from '../../shared/tarjeta-obra/tarjeta-obra';

@Component({
  selector: 'app-galeria',
  imports: [RouterLink, TarjetaObra],
  templateUrl: './galeria.html',
  styleUrl: './galeria.css',
})
export class Galeria implements OnInit {
  private artworks = inject(Artworks);
  auth = inject(Auth);

  obras = signal<Obra[]>([]);
  cargando = signal(true);
  error = signal('');

  async ngOnInit() {
    try {
      const reales = await this.artworks.publicadas();
      // Las de prueba solo existen con `ng serve`; en producción la lista está vacía
      this.obras.set([...reales, ...OBRAS_DEMO]);
    } catch (e) {
      console.error(e);
      this.obras.set(OBRAS_DEMO);
      this.error.set('No pudimos cargar las obras. Recargá la página para intentar de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}