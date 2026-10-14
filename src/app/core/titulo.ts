import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

// Cada página pone su nombre en la pestaña: "Carrito · Anverso".
// Las páginas de una obra o un artista lo cambian solas cuando cargan (ver detalle-obra y artista).
@Injectable({ providedIn: 'root' })
export class TituloAnverso extends TitleStrategy {
  private title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot) {
    const titulo = this.buildTitle(snapshot);
    this.title.setTitle(titulo ? `${titulo} · Anverso` : 'Anverso · Galería de arte');
  }
}
