import { Injectable, signal } from '@angular/core';
import {
  getAuth, sendSignInLinkToEmail, isSignInWithEmailLink,
  signInWithEmailLink, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, signOut, User
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase';

export type Rol = 'comprador' | 'artista';

const CLAVE_EMAIL = 'emailParaLogin';
const CLAVE_RETORNO = 'returnUrl';

@Injectable({ providedIn: 'root' })
export class Auth {
  private auth = getAuth(firebaseApp);
  private db = getFirestore(firebaseApp);

  usuario = signal<User | null>(null);
  rol = signal<Rol | null>(null);
  cargando = signal(true);

  private resolverListo!: () => void;
  private listoPromise = new Promise<void>(resolve => { this.resolverListo = resolve; });

  // Evita buscar/crear el perfil dos veces a la vez para el mismo usuario
  private perfilUid: string | null = null;
  private perfilPromise: Promise<Rol | null> | null = null;

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      this.usuario.set(user);
      this.rol.set(user ? await this.cargarPerfil(user) : null);
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

  private cargarPerfil(user: User): Promise<Rol | null> {
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
  // Se hace en un solo lugar para que el rol nunca quede en null por una carrera.
  private async asegurarPerfil(user: User): Promise<Rol> {
    const ref = doc(this.db, 'users', user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return snap.data()['role'] as Rol;
    }

    await setDoc(ref, {
      email: user.email,
      nombre: user.displayName ?? null,
      role: 'comprador',
      creadoEn: new Date().toISOString()
    });
    return 'comprador';
  }

  private async finalizarIngreso(user: User) {
    this.usuario.set(user);
    this.rol.set(await this.cargarPerfil(user));
  }

  // ---------- Login con email (link) ----------

  async enviarLinkDeAcceso(email: string, returnUrl = '/') {
    await sendSignInLinkToEmail(this.auth, email, {
      url: window.location.origin + '/login',
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
