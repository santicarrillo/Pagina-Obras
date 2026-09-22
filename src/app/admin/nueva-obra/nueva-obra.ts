import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Artworks } from '../../core/services/artworks';
import { Cloudinary } from '../../core/services/cloudinary';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 10;

@Component({
  selector: 'app-nueva-obra',
  imports: [FormsModule, RouterLink],
  templateUrl: './nueva-obra.html',
  styleUrl: './nueva-obra.css',
})
export class NuevaObra implements OnDestroy {
  private artworks = inject(Artworks);
  private cloudinary = inject(Cloudinary);
  private router = inject(Router);

  readonly anioActual = new Date().getFullYear();
  readonly MAX_DESCRIPCION = 1000;

  // Imagen
  archivo = signal<File | null>(null);
  vistaPrevia = signal<string | null>(null);
  errorImagen = signal('');
  arrastrando = signal(false);

  // Datos
  titulo = '';
  tecnica = '';
  alto: number | null = null;
  ancho: number | null = null;
  anio: number | null = null;
  precio: number | null = null;
  descripcion = '';

  intentoEnviar = signal(false);
  paso = signal<'' | 'subiendo' | 'guardando'>('');
  error = signal('');

  // ---------- Imagen ----------

  elegirArchivo(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (archivo) this.tomarArchivo(archivo);
    input.value = '';
  }

  soltar(evento: DragEvent) {
    evento.preventDefault();
    this.arrastrando.set(false);
    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo) this.tomarArchivo(archivo);
  }

  arrastrarEncima(evento: DragEvent) {
    evento.preventDefault();
    this.arrastrando.set(true);
  }

  private tomarArchivo(archivo: File) {
    this.errorImagen.set('');

    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      this.errorImagen.set('Usá una imagen JPG, PNG o WebP.');
      return;
    }
    if (archivo.size > MAX_MB * 1024 * 1024) {
      this.errorImagen.set(`La imagen pesa más de ${MAX_MB} MB. Probá con una más liviana.`);
      return;
    }

    this.liberarVistaPrevia();
    this.archivo.set(archivo);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  quitarImagen() {
    this.liberarVistaPrevia();
    this.archivo.set(null);
    this.vistaPrevia.set(null);
  }

  private liberarVistaPrevia() {
    const url = this.vistaPrevia();
    if (url) URL.revokeObjectURL(url);
  }

  ngOnDestroy() {
    this.liberarVistaPrevia();
  }

  // ---------- Validaciones ----------

  get tituloValido() {
    const largo = this.titulo.trim().length;
    return largo >= 1 && largo <= 100;
  }

  get tecnicaValida() {
    const largo = this.tecnica.trim().length;
    return largo >= 2 && largo <= 80;
  }

  get precioValido() {
    return this.precio !== null && Number.isInteger(this.precio) && this.precio > 0;
  }

  get anioValido() {
    return this.anio === null || (Number.isInteger(this.anio) && this.anio >= 1800 && this.anio <= this.anioActual);
  }

  get medidasValidas() {
    const ok = (n: number | null) => n === null || (n > 0 && n <= 1000);
    return ok(this.alto) && ok(this.ancho);
  }

  get formularioValido() {
    return !!this.archivo() && this.tituloValido && this.tecnicaValida
      && this.precioValido && this.anioValido && this.medidasValidas
      && this.descripcion.length <= this.MAX_DESCRIPCION;
  }

  get ocupado() {
    return this.paso() !== '';
  }

  // ---------- Publicar ----------

  async publicar() {
    this.intentoEnviar.set(true);
    this.error.set('');
    if (!this.archivo()) this.errorImagen.set('Falta la foto de la obra.');
    if (!this.formularioValido) return;

    try {
      this.paso.set('subiendo');
      const imagenUrl = await this.cloudinary.subirImagen(this.archivo()!);

      this.paso.set('guardando');
      await this.artworks.crear({
        titulo: this.titulo.trim(),
        tecnica: this.tecnica.trim(),
        medidas: this.alto && this.ancho ? `${this.alto} × ${this.ancho} cm` : '',
        anio: this.anio,
        precio: this.precio!,
        descripcion: this.descripcion.trim(),
        imagenUrl
      });

      this.router.navigate(['/admin/obras']);
    } catch {
      this.error.set(
        this.paso() === 'subiendo'
          ? 'No se pudo subir la imagen. Revisá tu conexión y probá de nuevo.'
          : 'La imagen se subió, pero no se pudo guardar la obra. Probá de nuevo.'
      );
      this.paso.set('');
    }
  }
}
