import { Injectable, inject } from '@angular/core';
import { getFirestore, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { firebaseApp } from './firebase';
import { Auth } from './auth';

export type EstadoPedido = 'pendiente' | 'pagado' | 'rechazado' | 'reembolsado' | 'conflicto' | 'error';

export interface ItemPedido {
  id: string;
  titulo: string;
  precio: number;
  imagenUrl: string;
  tecnica: string;
  envio: number | null;
}

export interface DireccionEnvio {
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  notas: string;
}

export interface Pedido {
  id: string;
  buyerId: string;
  buyerEmail: string | null;
  buyerNombre: string | null;
  artistId: string;
  artistaNombre: string;
  items: ItemPedido[];
  subtotal: number;
  costoEnvio: number;
  envioACoordinar: boolean;
  envio: DireccionEnvio | null;
  total: number;
  estado: EstadoPedido;
  creadoEn: Date | null;
  pagadoEn: Date | null;
}

@Injectable({ providedIn: 'root' })
export class Pedidos {
  private db = getFirestore(firebaseApp);
  private auth = inject(Auth);

  // Lo que compré
  misCompras() {
    return this.buscar('buyerId');
  }

  // Lo que me compraron (para artistas)
  misVentas() {
    return this.buscar('artistId');
  }

  private async buscar(campo: 'buyerId' | 'artistId'): Promise<Pedido[]> {
    const uid = this.auth.usuario()?.uid;
    if (!uid) return [];
    const snap = await getDocs(query(collection(this.db, 'orders'), where(campo, '==', uid)));
    return snap.docs
      .map(d => this.aPedido(d.id, d.data()))
      .sort((a, b) => (b.creadoEn?.getTime() ?? 0) - (a.creadoEn?.getTime() ?? 0));
  }

  private aPedido(id: string, d: Record<string, any>): Pedido {
    const fecha = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);
    return {
      id,
      buyerId: d['buyerId'],
      buyerEmail: d['buyerEmail'] ?? null,
      buyerNombre: d['buyerNombre'] ?? null,
      artistId: d['artistId'],
      artistaNombre: d['artistaNombre'] ?? '',
      items: d['items'] ?? [],
      subtotal: d['subtotal'] ?? d['total'] ?? 0,
      costoEnvio: d['costoEnvio'] ?? 0,
      envioACoordinar: d['envioACoordinar'] ?? false,
      envio: d['envio'] ?? null,
      total: d['total'] ?? 0,
      estado: d['estado'] ?? 'pendiente',
      creadoEn: fecha(d['creadoEn']),
      pagadoEn: fecha(d['pagadoEn'])
    };
  }
}
