import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = signal('');
  enviado = signal(false);
  cargando = signal(false);
  error = signal('');
  procesandoLink = signal(false);
  modo = signal<'login' | 'registro'>('login');

  constructor(private auth: Auth, private router: Router) {
    void this.inicializarLogin();
  }

  private async inicializarLogin() {
    await this.auth.esperarListo();

    if (this.auth.estaLogueado()) {
      this.router.navigate(['/']);
      return;
    }

    this.revisarSiEsLinkDeAcceso();
  }

  private async revisarSiEsLinkDeAcceso() {
    const url = window.location.href;
    if (!this.auth.esLinkDeAcceso(url)) return;

    this.procesandoLink.set(true);
    try {
      await this.auth.completarLogin(url);
      this.router.navigate(['/']);
    } catch {
      this.error.set('No se pudo completar el ingreso. Pedí el link de nuevo.');
      this.procesandoLink.set(false);
    }
  }

  cambiarModo(modo: 'login' | 'registro') {
    this.modo.set(modo);
    this.error.set('');
    this.enviado.set(false);
  }

  actualizarEmail(valor: string) {
    this.email.set(valor);
  }

  async enviarLink() {
    if (!this.email()) {
      this.error.set('Ingresá un email válido.');
      return;
    }

    this.cargando.set(true);
    this.error.set('');
    try {
      await this.auth.enviarLinkDeAcceso(this.email());
      this.enviado.set(true);
    } catch {
      this.error.set(this.modo() === 'registro'
        ? 'No se pudo crear la cuenta. Revisá el email.'
        : 'No se pudo enviar el link. Revisá el email.');
    } finally {
      this.cargando.set(false);
    }
  }
}