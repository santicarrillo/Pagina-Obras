import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Artworks, Obra } from './artworks';
import { Auth } from './auth';
import { OBRAS_DEMO } from '../data/obras-demo';

// Lo mínimo para mostrar el carrito sin volver a pedir cada obra
export interface ItemCarrito {
  id: string;
  titulo: string;
  artistId: string;
  artistaNombre: string;
  precio: number;
  imagenUrl: string;
}

const CLAVE = 'anverso-carrito';

@Injectable({ providedIn: 'root' })
export class Carrito {
  private artworks = inject(Artworks);
  private auth = inject(Auth);

  // Cada obra es única: está en el carrito o no está, no hay cantidades
  items = signal<ItemCarrito[]>(this.leer());
  cantidad = computed(() => this.items().length);
  total = computed(() => this.items().reduce((suma, i) => suma + i.precio, 0));

  // Avisos para mostrar en la página del carrito (obras que se vendieron, precios que cambiaron)
  avisos = signal<string[]>([]);

  constructor() {
    // Se guarda en el navegador, así no se pierde al recargar o cerrar la pestaña
    effect(() => {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(this.items()));
      } catch {
        // Modo incógnito o almacenamiento bloqueado: el carrito funciona igual mientras dure la visita
      }
    });
  }

  tiene(id: string) {
    return this.items().some(i => i.id === id);
  }

  agregar(obra: Obra) {
    if (this.tiene(obra.id) || obra.estado !== 'publicada') return;
    // Nadie puede comprar sus propias obras
    if (obra.artistId === this.auth.usuario()?.uid) return;
    this.items.update(lista => [...lista, {
      id: obra.id,
      titulo: obra.titulo,
      artistId: obra.artistId,
      artistaNombre: obra.artistaNombre,
      precio: obra.precio,
      imagenUrl: obra.imagenUrl
    }]);
  }

  quitar(id: string) {
    this.items.update(lista => lista.filter(i => i.id !== id));
  }

  vaciar() {
    this.items.set([]);
  }

  // Vuelve a consultar cada obra: saca las que ya se vendieron o se borraron,
  // y actualiza el precio si el artista lo cambió. Se llama al abrir el carrito.
  async revisar() {
    const avisos: string[] = [];
    const vigentes: ItemCarrito[] = [];

    for (const item of this.items()) {
      let obra: Obra | null = OBRAS_DEMO.find(o => o.id === item.id) ?? null;
      if (!obra && !item.id.startsWith('demo-')) {
        try {
          obra = await this.artworks.obtener(item.id);
        } catch {
          // Sin conexión: se deja como está y se revisa la próxima vez
          vigentes.push(item);
          continue;
        }
      }

      if (!obra || obra.estado !== 'publicada') {
        avisos.push(`"${item.titulo}" ya no está disponible y la sacamos de tu carrito.`);
        continue;
      }
      if (obra.precio !== item.precio) {
        avisos.push(`El precio de "${item.titulo}" cambió.`);
      }
      vigentes.push({ ...item, precio: obra.precio, titulo: obra.titulo, imagenUrl: obra.imagenUrl });
    }

    this.items.set(vigentes);
    this.avisos.set(avisos);
  }

  private leer(): ItemCarrito[] {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
      return Array.isArray(guardado) ? guardado : [];
    } catch {
      return [];
    }
  }
}
