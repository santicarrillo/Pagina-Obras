import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Artworks, Obra } from '../../core/services/artworks';
import { Auth } from '../../core/services/auth';
import { ImagenPipe } from '../../shared/imagen.pipe';

@Component({
  selector: 'app-editar-obra',
  imports: [FormsModule, RouterLink, ImagenPipe],
  templateUrl: './editar-obra.html',
  styleUrls: ['../nueva-obra/nueva-obra.css', './editar-obra.css'],
})
export class EditarObra implements OnInit {
  private artworks = inject(Artworks);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly anioActual = new Date().getFullYear();
  readonly MAX_DESCRIPCION = 1000;

  obra = signal<Obra | null>(null);
  cargando = signal(true);
  errorCarga = signal('');

  titulo = '';
  tecnica = '';
  alto: number | null = null;
  ancho: number | null = null;
  anio: number | null = null;
  precio: number | null = null;
  envio: number | null = null;
  descripcion = '';

  intentoEnviar = signal(false);
  guardando = signal(false);
  error = signal('');

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      const obra = await this.artworks.obtener(id);
      if (!obra || obra.artistId !== this.auth.usuario()?.uid) {
        this.errorCarga.set('No encontramos esta obra entre las tuyas.');
        return;
      }
      if (obra.estado === 'vendida') {
        this.errorCarga.set('Esta obra ya se vendió, así que no se puede editar.');
        return;
      }
      this.obra.set(obra);
      this.titulo = obra.titulo;
      this.tecnica = obra.tecnica;
      this.anio = obra.anio;
      this.precio = obra.precio;
      this.envio = obra.envio;
      this.descripcion = obra.descripcion;
      // "80 × 60 cm" → alto 80, ancho 60
      const m = obra.medidas.match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)/i);
      if (m) {
        this.alto = Number(m[1].replace(',', '.'));
        this.ancho = Number(m[2].replace(',', '.'));
      }
    } catch (e) {
      console.error(e);
      this.errorCarga.set('No pudimos cargar la obra. Recargá la página para intentar de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  // ---------- Validaciones (las mismas que al subirla) ----------

  get tituloValido() {
    const n = this.titulo.trim().length;
    return n >= 1 && n <= 100;
  }

  get tecnicaValida() {
    const n = this.tecnica.trim().length;
    return n >= 2 && n <= 80;
  }

  get precioValido() {
    return this.precio !== null && Number.isInteger(this.precio) && this.precio > 0;
  }

  get envioValido() {
    return this.envio !== null && Number.isInteger(this.envio) && this.envio >= 0 && this.envio <= 10000000;
  }

  get anioValido() {
    return this.anio === null || (Number.isInteger(this.anio) && this.anio >= 1800 && this.anio <= this.anioActual);
  }

  get medidasValidas() {
    const ok = (n: number | null) => n === null || (n > 0 && n <= 1000);
    return ok(this.alto) && ok(this.ancho);
  }

  get formularioValido() {
    return this.tituloValido && this.tecnicaValida && this.precioValido && this.envioValido
      && this.anioValido && this.medidasValidas && this.descripcion.length <= this.MAX_DESCRIPCION;
  }

  async guardar() {
    this.intentoEnviar.set(true);
    this.error.set('');
    const obra = this.obra();
    if (!obra || !this.formularioValido) return;

    this.guardando.set(true);
    try {
      await this.artworks.actualizar(obra.id, {
        titulo: this.titulo.trim(),
        tecnica: this.tecnica.trim(),
        medidas: this.alto && this.ancho ? `${this.alto} × ${this.ancho} cm` : '',
        anio: this.anio,
        precio: this.precio!,
        envio: this.envio!,
        descripcion: this.descripcion.trim()
      });
      this.router.navigate(['/admin/obras'], { queryParams: { editada: obra.id } });
    } catch (e: any) {
      console.error(e);
      this.error.set(
        e?.code === 'permission-denied'
          ? 'No se pudo guardar: revisá que la obra no se haya vendido.'
          : 'No se pudieron guardar los cambios. Probá de nuevo.'
      );
      this.guardando.set(false);
    }
  }
}
