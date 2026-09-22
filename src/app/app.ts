import { Component, inject, signal } from '@angular/core';
import {  Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './core/services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('PaginaParaComprasDeObras');
  private router = inject(Router);
  menuAbierto = signal(false);

  constructor(public auth: Auth) {}

  get nombreUsuario(): string {
    const usuario = this.auth.usuario();
    if (usuario?.displayName) return usuario.displayName.split(' ')[0];
    const email = usuario?.email ?? '';
    return email ? email.split('@')[0] : 'Usuario';
  }

  get fotoUsuario(): string | null {
    return this.auth.usuario()?.photoURL ?? null;
  }

  get inicialUsuario(): string {
    return this.nombreUsuario.charAt(0).toUpperCase();
  }

  get mostrarNavegacion(): boolean {
    return !this.router.url.startsWith('/login');
  }

  irAlHome() {
    this.menuAbierto.set(false);
    this.router.navigate(['/']);
  }

  irALogin() {
    this.router.navigate(['/login']);
  }

  async cerrarSesion() {
    await this.auth.salir();
    this.menuAbierto.set(false);
    this.router.navigate(['/login']);
  }

  alternarMenu() {
    this.menuAbierto.set(!this.menuAbierto());
  }
}
