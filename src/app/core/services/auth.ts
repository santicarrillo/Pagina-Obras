import { Injectable, signal } from '@angular/core';
import {
  getAuth, sendSignInLinkToEmail, isSignInWithEmailLink,
  signInWithEmailLink, onAuthStateChanged, signOut, User
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase';
export type Rol = 'comprador' | 'artista';

@Injectable({ providedIn: 'root' })
export class Auth {
  private auth = getAuth(firebaseApp);
  private db = getFirestore(firebaseApp);

  usuario = signal<User | null>(null);
  rol = signal<Rol | null>(null);
  cargando = signal(true);

  private resolverListo!: () => void;
  private listoPromise = new Promise<void>(resolve => { this.resolverListo = resolve; });

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      this.usuario.set(user);
      this.rol.set(user ? await this.buscarRol(user.uid) : null);
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

  private async buscarRol(uid: string): Promise<Rol | null> {
    const snap = await getDoc(doc(this.db, 'users', uid));
    return snap.exists() ? (snap.data()['role'] as Rol) : null;
  }

  async enviarLinkDeAcceso(email: string) {
    await sendSignInLinkToEmail(this.auth, email, {
      url: window.location.origin + '/login',
      handleCodeInApp: true
    });
    window.localStorage.setItem('emailParaLogin', email);
  }

  esLinkDeAcceso(url: string) {
    return isSignInWithEmailLink(this.auth, url);
  }

  async completarLogin(url: string) {
  let email = window.localStorage.getItem('emailParaLogin');
  if (!email) {
    email = window.prompt('Confirmá tu email para completar el ingreso') ?? '';
  }
  const credencial = await signInWithEmailLink(this.auth, email, url);
  window.localStorage.removeItem('emailParaLogin');

  const ref = doc(this.db, 'users', credencial.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: credencial.user.email,
      role: 'comprador',
      creadoEn: new Date().toISOString()
    });
    this.rol.set('comprador');
  } else {
    this.rol.set(snap.data()['role'] as Rol);
  }
}

  async salir() {
    await signOut(this.auth);
  }
}