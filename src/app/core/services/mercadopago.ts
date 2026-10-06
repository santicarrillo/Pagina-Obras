import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase';

// Misma región donde están desplegadas las funciones (functions/index.js)
const functions = getFunctions(firebaseApp, 'southamerica-east1');

// A dónde manda la obra el artista. Lo completa el comprador antes de pagar.
export interface DatosEnvio {
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  notas: string;
}

export const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

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
  async iniciarPago(obraIds: string[], envio: DatosEnvio): Promise<string> {
    const fn = httpsCallable<{ obraIds: string[]; envio: DatosEnvio }, { url: string; ordenId: string }>(
      functions, 'crearPago'
    );
    const { data } = await fn({ obraIds, envio });
    return data.url;
  }

  // Si el artista deja de ser artista, se olvida lo que sabíamos de su cuenta
  olvidar(artistId: string) {
    this.conectados.delete(artistId);
  }
}

// Texto amigable para los errores que devuelven las funciones
export function mensajeDeError(e: any, porDefecto: string): string {
  const conMensaje = ['failed-precondition', 'invalid-argument', 'unauthenticated'];
  const codigo = String(e?.code ?? '').replace('functions/', '');
  return conMensaje.includes(codigo) && e?.message ? e.message : porDefecto;
}
