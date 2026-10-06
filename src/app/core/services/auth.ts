import { Injectable, computed, signal } from '@angular/core';
import {
  getAuth, sendSignInLinkToEmail, isSignInWithEmailLink,
  signInWithEmailLink, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, signOut, User
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from './firebase';

export type Rol = 'comprador';

// Datos públicos del artista (colección `artists`, un documento por uid)
export interface PerfilArtista {
  nombreArtistico: string;
  ciudad: string;
  bio: string;
  instagram: string;
}

interface Perfil {
  rol: Rol;
  artista: PerfilArtista | null;
}

const CLAVE_EMAIL = 'emailParaLogin';
const CLAVE_RETORNO = 'returnUrl';

@Injectable({ providedIn: 'root' })
export class Auth {
  private auth = getAuth(firebaseApp);
  private db = getFirestore(firebaseApp);

  usuario = signal<User | null>(null);
  rol = signal<Rol | null>(null);
  // Todos son compradores; ser artista es algo que se suma encima
  perfilArtista = signal<PerfilArtista | null>(null);
  esArtista = computed(() => this.perfilArtista() !== null);
  cargando = signal(true);

  private resolverListo!: () => void;
  private listoPromise = new Promise<void>(resolve => { this.resolverListo = resolve; });

  // Evita buscar/crear el perfil dos veces a la vez para el mismo usuario
  private perfilUid: string | null = null;
  private perfilPromise: Promise<Perfil | null> | null = null;

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      this.usuario.set(user);
      this.aplicarPerfil(user ? await this.cargarPerfil(user) : null);
      this.cargando.set(false);
      this.resolverListo();
    });
  }

  async esperarListo() {
    return this.listoPromise;
  }

  estaLogueado() {
    return this.usuario() !== null;
  }

  // ---------- Perfil y rol ----------

  private aplicarPerfil(perfil: Perfil | null) {
    this.rol.set(perfil?.rol ?? null);
    this.perfilArtista.set(perfil?.artista ?? null);
  }

  private cargarPerfil(user: User): Promise<Perfil | null> {
    if (this.perfilUid !== user.uid || !this.perfilPromise) {
      this.perfilUid = user.uid;
      this.perfilPromise = this.asegurarPerfil(user).catch(() => {
        this.perfilPromise = null;
        return null;
      });
    }
    return this.perfilPromise;
  }

  // Busca el documento del usuario y, si no existe, lo crea como comprador.
  // Después se fija si además tiene perfil de artista.
  private async asegurarPerfil(user: User): Promise<Perfil> {
    const ref = doc(this.db, 'users', user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        email: user.email,
        nombre: user.displayName ?? null,
        role: 'comprador',
        creadoEn: new Date().toISOString()
      });
    }

    const artistaSnap = await getDoc(doc(this.db, 'artists', user.uid));
    const artista = artistaSnap.exists() ? (artistaSnap.data() as PerfilArtista) : null;

    return { rol: 'comprador', artista };
  }

  private async finalizarIngreso(user: User) {
    this.usuario.set(user);
    this.aplicarPerfil(await this.cargarPerfil(user));
  }

  // ---------- Alta de artista ----------

  async activarPerfilArtista(datos: PerfilArtista) {
    const user = this.usuario();
    if (!user) throw new Error('Tenés que iniciar sesión');

    await setDoc(doc(this.db, 'artists', user.uid), {
      ...datos,
      creadoEn: serverTimestamp()
    });

    this.perfilArtista.set(datos);
    this.perfilPromise = Promise.resolve({ rol: 'comprador', artista: datos });
  }

  async actualizarPerfilArtista(datos: PerfilArtista) {
    const user = this.usuario();
    if (!user || !this.esArtista()) throw new Error('No tenés perfil de artista');

    // Solo se mandan estos 4 campos: la fecha de alta no se toca
    await updateDoc(doc(this.db, 'artists', user.uid), {
      nombreArtistico: datos.nombreArtistico,
      ciudad: datos.ciudad,
      bio: datos.bio,
      instagram: datos.instagram
    });

    this.perfilArtista.set(datos);
    this.perfilPromise = Promise.resolve({ rol: 'comprador', artista: datos });
  }

  // Vuelve a ser solo comprador. El servidor pausa sus obras, borra el perfil de artista
  // y desconecta Mercado Pago. Sus ventas y compras quedan como están.
  async dejarDeSerArtista(): Promise<number> {
    const user = this.usuario();
    if (!user || !this.esArtista()) throw new Error('No tenés perfil de artista');

    const fn = httpsCallable<void, { obrasPausadas: number }>(
      getFunctions(firebaseApp, 'southamerica-east1'), 'dejarDeSerArtista'
    );
    const { data } = await fn();

    this.perfilArtista.set(null);
    this.perfilPromise = Promise.resolve({ rol: 'comprador', artista: null });
    return data.obrasPausadas;
  }

  // ---------- Login con email (link) ----------

  async enviarLinkDeAcceso(email: string, returnUrl = '/') {
    await sendSignInLinkToEmail(this.auth, email, {
      url: new URL('login', document.baseURI).href,
      handleCodeInApp: true
    });
    window.localStorage.setItem(CLAVE_EMAIL, email);
    window.localStorage.setItem(CLAVE_RETORNO, returnUrl);
  }

  esLinkDeAcceso(url: string) {
    return isSignInWithEmailLink(this.auth, url);
  }

  async completarLogin(url: string) {
    let email = window.localStorage.getItem(CLAVE_EMAIL);
    if (!email) {
      email = window.prompt('Confirmá tu email para completar el ingreso') ?? '';
    }

    const credencial = await signInWithEmailLink(this.auth, email, url);
    window.localStorage.removeItem(CLAVE_EMAIL);
    await this.finalizarIngreso(credencial.user);
  }

  // Devuelve (y borra) a dónde volver después de un login por link
  consumirReturnUrl(): string | null {
    const destino = window.localStorage.getItem(CLAVE_RETORNO);
    window.localStorage.removeItem(CLAVE_RETORNO);
    return destino;
  }

  // ---------- Login con Google ----------

  async ingresarConGoogle() {
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });

    const credencial = await signInWithPopup(this.auth, proveedor);
    await this.finalizarIngreso(credencial.user);
  }

  // ---------- Salir ----------

  async salir() {
    await signOut(this.auth);
    this.perfilUid = null;
    this.perfilPromise = null;
  }
}
