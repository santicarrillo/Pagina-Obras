import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-quiero-vender',
  imports: [FormsModule],
  templateUrl: './quiero-vender.html',
  styleUrl: './quiero-vender.css'
})
export class QuieroVender {
  private auth = inject(Auth);
  private router = inject(Router);

  nombreArtistico = this.auth.usuario()?.displayName ?? '';
  ciudad = '';
  bio = '';
  instagram = '';
  telefono = '';
  codigoPostal = '';

  intentoEnviar = signal(false);
  guardando = signal(false);
  error = signal('');

  readonly MAX_BIO = 600;

  get nombreValido() {
    const largo = this.nombreArtistico.trim().length;
    return largo >= 2 && largo <= 60;
  }

  get bioValida() {
    const largo = this.bio.trim().length;
    return largo >= 20 && largo <= this.MAX_BIO;
  }

  get telefonoValido() {
    return /^[\d\s()+-]{6,20}$/.test(this.telefono.trim());
  }

  get codigoPostalValido() {
    return /^[A-Za-z0-9]{4,8}$/.test(this.codigoPostal.trim());
  }

  async activar() {
    this.intentoEnviar.set(true);
    this.error.set('');
    if (!this.nombreValido || !this.bioValida || !this.telefonoValido || !this.codigoPostalValido) return;

    this.guardando.set(true);
    try {
      await this.auth.guardarContacto({
        telefono: this.telefono.trim(),
        codigoPostal: this.codigoPostal.trim().toUpperCase()
      });
      await this.auth.activarPerfilArtista({
        nombreArtistico: this.nombreArtistico.trim(),
        ciudad: this.ciudad.trim(),
        bio: this.bio.trim(),
        instagram: this.instagram.trim().replace(/^@/, '')
      });
      this.router.navigate(['/admin/obras']);
    } catch (e: any) {
      console.error(e);
      this.error.set(
        e?.code === 'permission-denied'
          ? 'No tenés permiso para crear el perfil. Revisá las reglas de Firestore.'
          : 'No pudimos activar tu perfil. Revisá tu conexión y probá de nuevo.'
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
