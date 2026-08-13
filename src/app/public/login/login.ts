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

  constructor(private auth: Auth, private router: Router) {
    this.revisarSiEsLinkDeAcceso();
  }

  private async revisarSiEsLinkDeAcceso() {
    const url = window.location.href;
    if (!this.auth.esLinkDeAcceso(url)) return;

    this.procesandoLink.set(true);
    try {
      await this.auth.completarLogin(url);
      const rol = this.auth.rol();
      this.router.navigate([rol === 'artista' ? '/admin' : '/mis-pedidos']);
    } catch {
      this.error.set('No se pudo completar el ingreso. Pedí el link de nuevo.');
      this.procesandoLink.set(false);
    }
  }

  actualizarEmail(valor: string) {
    this.email.set(valor);
  }

  async enviarLink() {
    if (!this.email()) return;
    this.cargando.set(true);
    this.error.set('');
    try {
      await this.auth.enviarLinkDeAcceso(this.email());
      this.enviado.set(true);
    } catch {
      this.error.set('No se pudo enviar el link. Revisá el email.');
    } finally {
      this.cargando.set(false);
    }
  }
}