import { Injectable, inject } from '@angular/core';
import { getFirestore, collection, getDocs, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from './firebase';
import { Auth } from './auth';

// Después del pago: preparando → enviado → entregado
export type EstadoEnvio = 'preparando' | 'enviado' | 'entregado';

// Todo envío viaja por un correo con seguimiento: así el comprador siempre puede rastrearlo
export type EmpresaEnvio = 'andreani' | 'correo' | 'oca';

export interface DatosEmpresa { nombre: string; url: string | null }

export const EMPRESAS: Record<EmpresaEnvio, DatosEmpresa> = {
  andreani: { nombre: 'Andreani', url: 'https://www.andreani.com/?tab=seguir-envio' },
  correo: { nombre: 'Correo Argentino', url: 'https://www.correoargentino.com.ar/formularios/e-commerce' },
  oca: { nombre: 'OCA', url: 'https://www.oca.com.ar/Busquedas/Envios' }
};

// Opciones que ya no se pueden elegir, pero que pueden figurar en pedidos viejos
const EMPRESAS_ANTERIORES: Record<string, DatosEmpresa> = {
  otra: { nombre: 'Otra empresa', url: null },
  mano: { nombre: 'Entrega en mano', url: null }
};

export function datosEmpresa(empresa: string | null | undefined): DatosEmpresa | null {
  if (!empresa) return null;
  return EMPRESAS[empresa as EmpresaEnvio] ?? EMPRESAS_ANTERIORES[empresa] ?? null;
}

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
  envioEstado: EstadoEnvio | null;
  seguimiento: { empresa: string; codigo: string } | null;
  artistaContacto: { email: string | null; telefono: string | null } | null;
  enviadoEn: Date | null;
  entregadoEn: Date | null;
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

  // Ventas pagadas que el artista todavía no despachó, en vivo (para el aviso del menú).
  // Devuelve la función para dejar de escuchar.
  escucharPorDespachar(uid: string, alCambiar: (cantidad: number) => void): () => void {
    const q = query(
      collection(this.db, 'orders'),
      where('artistId', '==', uid),
      where('estado', '==', 'pagado'),
      where('envioEstado', '==', 'preparando')
    );
    return onSnapshot(q, snap => alCambiar(snap.size), err => {
      console.error('No se pudieron revisar las ventas', err);
      alCambiar(0);
    });
  }

  // El artista marca el envío (con empresa y código) o la entrega; el comprador confirma que la recibió
  async actualizarEnvio(ordenId: string, estado: 'enviado' | 'entregado', empresa?: EmpresaEnvio, codigo?: string) {
    const fn = httpsCallable(getFunctions(firebaseApp, 'southamerica-east1'), 'actualizarEnvio');
    await fn({ ordenId, estado, empresa, codigo });
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
      envioEstado: d['envioEstado'] ?? (d['estado'] === 'pagado' ? 'preparando' : null),
      seguimiento: d['seguimiento'] ?? null,
      artistaContacto: d['artistaContacto'] ?? null,
      enviadoEn: fecha(d['enviadoEn']),
      entregadoEn: fecha(d['entregadoEn']),
      estado: d['estado'] ?? 'pendiente',
      creadoEn: fecha(d['creadoEn']),
      pagadoEn: fecha(d['pagadoEn'])
    };
  }
}
