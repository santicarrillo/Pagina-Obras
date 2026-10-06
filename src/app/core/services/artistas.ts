import { Injectable } from '@angular/core';
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { firebaseApp } from './firebase';
import { Obra } from './artworks';
import { ARTISTAS_DEMO, OBRAS_DEMO } from '../data/obras-demo';

export interface Artista {
  id: string;
  nombreArtistico: string;
  ciudad: string;
  bio: string;
  instagram: string;
}

// Saca tildes y pasa a minúsculas: "Lucía" y "lucia" encuentran lo mismo
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

@Injectable({ providedIn: 'root' })
export class Artistas {
  private db = getFirestore(firebaseApp);
  private cache: Promise<Artista[]> | null = null;

  // Todos los artistas. Se piden una sola vez y quedan guardados:
  // con pocos cientos de artistas, buscar en memoria es instantáneo y gratis.
  todos(): Promise<Artista[]> {
    if (!this.cache) {
      this.cache = getDocs(collection(this.db, 'artists'))
        .then(snap => [...snap.docs.map(d => this.aArtista(d.id, d.data())), ...ARTISTAS_DEMO])
        .catch(e => {
          this.cache = null;
          throw e;
        });
    }
    return this.cache;
  }

  async buscar(texto: string, max = 6): Promise<Artista[]> {
    const q = normalizar(texto);
    if (!q) return [];
    const lista = await this.todos();
    // Primero los que empiezan con lo buscado, después los que lo contienen
    const empiezan: Artista[] = [];
    const contienen: Artista[] = [];
    for (const a of lista) {
      const nombre = normalizar(a.nombreArtistico);
      if (nombre.startsWith(q) || nombre.split(' ').some(p => p.startsWith(q))) empiezan.push(a);
      else if (nombre.includes(q) || normalizar(a.ciudad).includes(q)) contienen.push(a);
    }
    return [...empiezan, ...contienen].slice(0, max);
  }

  async obtener(id: string): Promise<Artista | null> {
    const demo = ARTISTAS_DEMO.find(a => a.id === id);
    if (demo) return demo;
    const snap = await getDoc(doc(this.db, 'artists', id));
    return snap.exists() ? this.aArtista(snap.id, snap.data()) : null;
  }

  // Obras a la venta de un artista, las más nuevas primero
  async obras(id: string): Promise<Obra[]> {
    const demo = OBRAS_DEMO.filter(o => o.artistId === id);
    if (demo.length) return demo;

    const snap = await getDocs(query(
      collection(this.db, 'artworks'),
      where('artistId', '==', id),
      where('estado', '==', 'publicada')
    ));
    return snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          artistId: data['artistId'],
          artistaNombre: data['artistaNombre'] ?? '',
          titulo: data['titulo'] ?? '',
          tecnica: data['tecnica'] ?? '',
          medidas: data['medidas'] ?? '',
          anio: data['anio'] ?? null,
          precio: data['precio'] ?? 0,
          envio: typeof data['envio'] === 'number' ? data['envio'] : null,
          descripcion: data['descripcion'] ?? '',
          imagenUrl: data['imagenUrl'] ?? '',
          estado: data['estado'],
          creadoEn: data['creadoEn']?.toDate?.() ?? null
        } as Obra;
      })
      .sort((a, b) => (b.creadoEn?.getTime() ?? 0) - (a.creadoEn?.getTime() ?? 0));
  }

  private aArtista(id: string, d: Record<string, any>): Artista {
    return {
      id,
      nombreArtistico: d['nombreArtistico'] ?? '',
      ciudad: d['ciudad'] ?? '',
      bio: d['bio'] ?? '',
      instagram: d['instagram'] ?? ''
    };
  }
}