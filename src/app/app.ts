import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Auth } from './core/services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('PaginaParaComprasDeObras');
  private router = inject(Router);
  menuAbierto = signal(false);

  constructor(public auth: Auth) {}

  get nombreUsuario(): string {
    const email = this.auth.usuario()?.email ?? '';
    return email ? email.split('@')[0] : 'Usuario';
  }

  get mostrarNavegacion(): boolean {
    return !this.router.url.startsWith('/login');
  }

  irAlHome() {
    if (this.router.url === '/login') {
      return;
    }

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
