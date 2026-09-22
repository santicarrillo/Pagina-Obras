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

  async activar() {
    this.intentoEnviar.set(true);
    this.error.set('');
    if (!this.nombreValido || !this.bioValida) return;

    this.guardando.set(true);
    try {
      await this.auth.activarPerfilArtista({
        nombreArtistico: this.nombreArtistico.trim(),
        ciudad: this.ciudad.trim(),
        bio: this.bio.trim(),
        instagram: this.instagram.trim().replace(/^@/, '')
      });
      this.router.navigate(['/admin/obras']);
    } catch {
      this.error.set('No pudimos activar tu perfil. Revisá tu conexión y probá de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
