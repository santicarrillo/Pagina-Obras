import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase';

// Misma región donde están desplegadas las funciones (functions/index.js)
const functions = getFunctions(firebaseApp, 'southamerica-east1');

@Injectable({ providedIn: 'root' })
export class Pagos {
  private db = getFirestore(firebaseApp);
  private conectados = new Map<string, Promise<boolean>>();

  // ¿Este artista ya conectó su Mercado Pago y puede cobrar?
  puedeCobrar(artistId: string): Promise<boolean> {
    // Los artistas de prueba (solo en ng serve) se muestran como habilitados
    if (artistId.startsWith('demo-')) return Promise.resolve(true);

    if (!this.conectados.has(artistId)) {
      this.conectados.set(artistId,
        getDoc(doc(this.db, 'pagos_artistas', artistId))
          .then(s => s.exists() && s.data()['conectado'] === true)
          .catch(() => {
            this.conectados.delete(artistId);
            return false;
          })
      );
    }
    return this.conectados.get(artistId)!;
  }

  // Lleva al artista a Mercado Pago para autorizar a Anverso a cobrar en su nombre
  async conectarMercadoPago() {
    const fn = httpsCallable<void, { url: string }>(functions, 'mpConectarUrl');
    const { data } = await fn();
    window.location.href = data.url;
  }

  // Crea el pedido y devuelve la URL de Mercado Pago donde el comprador paga
  async iniciarPago(obraIds: string[]): Promise<string> {
    const fn = httpsCallable<{ obraIds: string[] }, { url: string; ordenId: string }>(functions, 'crearPago');
    const { data } = await fn({ obraIds });
    return data.url;
  }
}

// Texto amigable para los errores que devuelven las funciones
export function mensajeDeError(e: any, porDefecto: string): string {
  const conMensaje = ['failed-precondition', 'invalid-argument', 'unauthenticated'];
  const codigo = String(e?.code ?? '').replace('functions/', '');
  return conMensaje.includes(codigo) && e?.message ? e.message : porDefecto;
}
