import { Injectable, inject } from '@angular/core';
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc,
  query, where, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { firebaseApp } from './firebase';
import { Auth } from './auth';

// procesando: esperando la moderación automática (todavía no se usa)
// publicada:  visible en la galería
// rechazada:  la moderación la bajó, con motivoRechazo
// vendida:    ya se compró
export type EstadoObra = 'procesando' | 'publicada' | 'rechazada' | 'vendida';

export interface Obra {
  id: string;
  artistId: string;
  artistaNombre: string;
  titulo: string;
  tecnica: string;
  medidas: string;
  anio: number | null;
  precio: number;
  descripcion: string;
  imagenUrl: string;
  estado: EstadoObra;
  motivoRechazo?: string;
  creadoEn: Date | null;
}

// Lo que completa el artista en el formulario
export type DatosObra = Pick<Obra, 'titulo' | 'tecnica' | 'medidas' | 'anio' | 'precio' | 'descripcion' | 'imagenUrl'>;

// Mientras no exista la moderación automática, las obras se publican directo.
// Cuando esté la Firebase Function, esto pasa a 'procesando' (y también en las reglas).
const ESTADO_INICIAL: EstadoObra = 'publicada';

@Injectable({ providedIn: 'root' })
export class Artworks {
  private db = getFirestore(firebaseApp);
  private auth = inject(Auth);
  private coleccion = collection(this.db, 'artworks');

  async crear(datos: DatosObra): Promise<string> {
    const user = this.auth.usuario();
    const artista = this.auth.perfilArtista();
    if (!user || !artista) throw new Error('Necesitás un perfil de artista para publicar');

    const ref = await addDoc(this.coleccion, {
      ...datos,
      artistId: user.uid,
      artistaNombre: artista.nombreArtistico,
      estado: ESTADO_INICIAL,
      creadoEn: serverTimestamp()
    });
    return ref.id;
  }

  // Obras del artista logueado, las más nuevas primero
  async misObras(): Promise<Obra[]> {
    const user = this.auth.usuario();
    if (!user) return [];

    const snap = await getDocs(query(this.coleccion, where('artistId', '==', user.uid)));
    // Se ordena acá para no tener que crear un índice compuesto en Firestore
    return snap.docs
      .map(d => this.aObra(d.id, d.data()))
      .sort((a, b) => (b.creadoEn?.getTime() ?? 0) - (a.creadoEn?.getTime() ?? 0));
  }

  async eliminar(id: string) {
    await deleteDoc(doc(this.db, 'artworks', id));
  }

  private aObra(id: string, data: Record<string, any>): Obra {
    return {
      id,
      artistId: data['artistId'],
      artistaNombre: data['artistaNombre'] ?? '',
      titulo: data['titulo'] ?? '',
      tecnica: data['tecnica'] ?? '',
      medidas: data['medidas'] ?? '',
      anio: data['anio'] ?? null,
      precio: data['precio'] ?? 0,
      descripcion: data['descripcion'] ?? '',
      imagenUrl: data['imagenUrl'] ?? '',
      estado: data['estado'] ?? 'procesando',
      motivoRechazo: data['motivoRechazo'],
      creadoEn: data['creadoEn'] instanceof Timestamp ? data['creadoEn'].toDate() : null
    };
  }
}
