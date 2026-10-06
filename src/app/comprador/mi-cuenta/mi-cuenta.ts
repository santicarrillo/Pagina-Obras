import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { mensajeDeError } from '../../core/services/mercadopago';

@Component({
  selector: 'app-mi-cuenta',
  imports: [RouterLink],
  templateUrl: './mi-cuenta.html',
  styleUrl: './mi-cuenta.css',
})
export class MiCuenta {
  auth = inject(Auth);
  private router = inject(Router);

  confirmando = signal(false);
  textoConfirmacion = signal('');
  eliminando = signal(false);
  error = signal('');

  readonly PALABRA = 'ELIMINAR';

  async eliminar() {
    if (this.textoConfirmacion().trim().toUpperCase() !== this.PALABRA) return;
    this.eliminando.set(true);
    this.error.set('');
    try {
      await this.auth.eliminarCuenta();
      this.router.navigate(['/'], { queryParams: { baja: 'cuenta' } });
    } catch (e: any) {
      console.error(e);
      this.error.set(mensajeDeError(e, 'No pudimos eliminar la cuenta. Probá de nuevo en un rato.'));
      this.eliminando.set(false);
    }
  }
}
