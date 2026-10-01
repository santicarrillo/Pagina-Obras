import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-perfil',
  imports: [FormsModule, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil {
  private auth = inject(Auth);

  // Arranca con los datos actuales del artista
  private actual = this.auth.perfilArtista();
  nombreArtistico = this.actual?.nombreArtistico ?? '';
  ciudad = this.actual?.ciudad ?? '';
  bio = this.actual?.bio ?? '';
  instagram = this.actual?.instagram ?? '';

  readonly MAX_BIO = 600;

  intentoEnviar = signal(false);
  guardando = signal(false);
  guardado = signal(false);
  error = signal('');

  get nombreValido() {
    const largo = this.nombreArtistico.trim().length;
    return largo >= 2 && largo <= 60;
  }

  get bioValida() {
    const largo = this.bio.trim().length;
    return largo >= 20 && largo <= this.MAX_BIO;
  }

  // Si cambia algo, se oculta el "Cambios guardados"
  tocado() {
    this.guardado.set(false);
  }

  async guardar() {
    this.intentoEnviar.set(true);
    this.error.set('');
    this.guardado.set(false);
    if (!this.nombreValido || !this.bioValida) return;

    this.guardando.set(true);
    try {
      await this.auth.activarPerfilArtista({
        nombreArtistico: this.nombreArtistico.trim(),
        ciudad: this.ciudad.trim(),
        bio: this.bio.trim(),
        instagram: this.instagram.trim().replace(/^@/, ''),
      });
      this.guardado.set(true);
    } catch (e: any) {
      console.error(e);
      this.error.set(
        e?.code === 'permission-denied'
          ? 'No tenés permiso para editar el perfil. Revisá las reglas de Firestore.'
          : 'No se pudieron guardar los cambios. Probá de nuevo.',
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
