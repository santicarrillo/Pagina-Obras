import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { Pagos, mensajeDeError } from '../../core/services/mercadopago';

@Component({
  selector: 'app-perfil',
  imports: [FormsModule, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil {
  private auth = inject(Auth);
  private pagos = inject(Pagos);
  private router = inject(Router);

  // Dejar de ser artista: primero se muestra la explicación, después se confirma
  confirmandoBaja = signal(false);
  dandoDeBaja = signal(false);
  errorBaja = signal('');

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
     await this.auth.actualizarPerfilArtista({
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

  async dejarDeSerArtista() {
    this.dandoDeBaja.set(true);
    this.errorBaja.set('');
    const uid = this.auth.usuario()?.uid;
    try {
      await this.auth.dejarDeSerArtista();
      if (uid) this.pagos.olvidar(uid);
      this.router.navigate(['/'], { queryParams: { baja: 'artista' } });
    } catch (e) {
      console.error(e);
      this.errorBaja.set(mensajeDeError(e, 'No pudimos procesar el cambio. Probá de nuevo en un rato.'));
      this.dandoDeBaja.set(false);
    }
  }
}
