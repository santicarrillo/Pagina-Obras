import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Artista, Artistas } from '../../core/services/artistas';

@Component({
  selector: 'app-buscador-artistas',
  templateUrl: './buscador-artistas.html',
  styleUrl: './buscador-artistas.css',
})
export class BuscadorArtistas {
  private artistas = inject(Artistas);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  texto = signal('');
  resultados = signal<Artista[]>([]);
  abierto = signal(false);
  activo = signal(0);
  error = signal(false);

  async escribir(valor: string) {
    this.texto.set(valor);
    this.activo.set(0);
    this.error.set(false);
    if (!valor.trim()) {
      this.resultados.set([]);
      this.abierto.set(false);
      return;
    }
    try {
      const lista = await this.artistas.buscar(valor);
      // Si mientras tanto el usuario siguió escribiendo, se ignora esta respuesta vieja
      if (this.texto() !== valor) return;
      this.resultados.set(lista);
    } catch (e) {
      console.error(e);
      this.error.set(true);
      this.resultados.set([]);
    }
    this.abierto.set(true);
  }

  // Precarga la lista apenas se toca el buscador, así la primera búsqueda es instantánea
  precargar() {
    this.artistas.todos().catch(() => {});
    if (this.texto().trim()) this.abierto.set(true);
  }

  teclas(e: KeyboardEvent) {
    const total = this.resultados().length;
    if (e.key === 'ArrowDown' && total) {
      e.preventDefault();
      this.abierto.set(true);
      this.activo.set((this.activo() + 1) % total);
    } else if (e.key === 'ArrowUp' && total) {
      e.preventDefault();
      this.activo.set((this.activo() - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const elegido = this.resultados()[this.activo()];
      if (elegido) this.ir(elegido);
    } else if (e.key === 'Escape') {
      this.abierto.set(false);
    }
  }

  ir(artista: Artista) {
    this.texto.set('');
    this.resultados.set([]);
    this.abierto.set(false);
    this.router.navigate(['/artista', artista.id]);
  }

  inicial(nombre: string) {
    return nombre.trim().charAt(0).toUpperCase();
  }

  // Cierra la lista al hacer clic afuera
  @HostListener('document:click', ['$event'])
  clicAfuera(e: MouseEvent) {
    if (!this.host.nativeElement.contains(e.target as Node)) this.abierto.set(false);
  }
}
