import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Artworks, EstadoObra, Obra } from '../../core/services/artworks';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-mis-obras',
  imports: [RouterLink],
  templateUrl: './mis-obras.html',
  styleUrl: './mis-obras.css',
})
export class MisObras implements OnInit {
  private artworks = inject(Artworks);
  auth = inject(Auth);

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
}
