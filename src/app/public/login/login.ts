import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = signal('');
  enviado = signal(false);
  cargando = signal(false);
  cargandoGoogle = signal(false);
  error = signal('');
  procesandoLink = signal(false);

  constructor() {
    void this.inicializarLogin();
  }

  private async inicializarLogin() {
    await this.auth.esperarListo();

    if (this.auth.estaLogueado()) {
      this.irADestino(this.returnUrlDeLaRuta());
      return;
    }

    await this.revisarSiEsLinkDeAcceso();
  }

  // Solo acepta rutas internas ("/algo"), nunca URLs de otros sitios
  private rutaSegura(url: string | null | undefined): string {
    if (url && url.startsWith('/') && !url.startsWith('//')) return url;
    return '/';
  }

  private returnUrlDeLaRuta(): string {
    return this.rutaSegura(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  private irADestino(url: string) {
    this.router.navigateByUrl(this.rutaSegura(url));
  }

  private async revisarSiEsLinkDeAcceso() {
    const url = window.location.href;
    if (!this.auth.esLinkDeAcceso(url)) return;

    this.procesandoLink.set(true);
    try {
      await this.auth.completarLogin(url);
      this.irADestino(this.auth.consumirReturnUrl() ?? '/');
    } catch {
      this.error.set('No se pudo completar el ingreso. Pedí el link de nuevo.');
      this.procesandoLink.set(false);
    }
  }

  actualizarEmail(valor: string) {
    this.email.set(valor.trim());
  }

  async enviarLink() {
    if (!this.email()) {
      this.error.set('Ingresá un email válido.');
      return;
    }

    this.cargando.set(true);
    this.error.set('');
    try {
      await this.auth.enviarLinkDeAcceso(this.email(), this.returnUrlDeLaRuta());
      this.enviado.set(true);
    } catch {
      this.error.set('No se pudo enviar el link. Revisá el email.');
    } finally {
      this.cargando.set(false);
    }
  }

  async ingresarConGoogle() {
    this.cargandoGoogle.set(true);
    this.error.set('');
    try {
      await this.auth.ingresarConGoogle();
      this.irADestino(this.returnUrlDeLaRuta());
    } catch (e: any) {
      // Si el usuario cerró la ventanita no mostramos error
      const cancelado = e?.code === 'auth/popup-closed-by-user'
        || e?.code === 'auth/cancelled-popup-request';
      if (!cancelado) {
        this.error.set('No se pudo ingresar con Google. Probá de nuevo.');
      }
    } finally {
      this.cargandoGoogle.set(false);
    }
  }
}
