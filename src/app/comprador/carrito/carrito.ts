import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Carrito, ItemCarrito } from '../../core/services/carrito';
import { Auth } from '../../core/services/auth';
import { DatosEnvio, PROVINCIAS, Pagos, mensajeDeError } from '../../core/services/mercadopago';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});

const CLAVE_ENVIO = 'anverso-datos-envio';

interface GrupoArtista {
  artistId: string;
  artistaNombre: string;
  items: ItemCarrito[];
  subtotal: number;
  envio: number;
  hayACoordinar: boolean;
  total: number;
}

@Component({
  selector: 'app-carrito',
  imports: [RouterLink, FormsModule],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
})
export class CarritoPagina implements OnInit {
  carrito = inject(Carrito);
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pagos = inject(Pagos);

  readonly provincias = PROVINCIAS;

  revisando = signal(true);
  pagando = signal<string | null>(null);   // artistId del grupo que se está pagando
  error = signal('');
  habilitados = signal<Record<string, boolean>>({});

  // Datos de envío: se recuerdan en este navegador para la próxima compra
  datos: DatosEnvio = this.leerDatos();
  intentoPagar = signal(false);

  // Cada pago va a la cuenta de un solo artista, por eso se agrupa
  grupos = computed<GrupoArtista[]>(() => {
    const mapa = new Map<string, GrupoArtista>();
    for (const item of this.carrito.items()) {
      const g = mapa.get(item.artistId) ?? {
        artistId: item.artistId, artistaNombre: item.artistaNombre,
        items: [], subtotal: 0, envio: 0, hayACoordinar: false, total: 0
      };
      g.items.push(item);
      g.subtotal += item.precio;
      g.envio += item.envio ?? 0;
      g.hayACoordinar ||= item.envio === null;
      g.total = g.subtotal + g.envio;
      mapa.set(item.artistId, g);
    }
    return [...mapa.values()];
  });

  async ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('pago') === 'error') {
      this.error.set('El pago no se completó. Tus obras siguen en el carrito, podés intentar de nuevo.');
    }
    await this.carrito.revisar();
    const estados: Record<string, boolean> = {};
    await Promise.all(this.grupos().map(async g => {
      estados[g.artistId] = await this.pagos.puedeCobrar(g.artistId);
    }));
    this.habilitados.set(estados);
    this.revisando.set(false);
  }

  precio(valor: number) {
    return PESOS.format(valor);
  }

  textoEnvio(item: ItemCarrito) {
    if (item.envio === null) return 'Envío a coordinar';
    return item.envio === 0 ? 'Envío gratis' : `Envío ${this.precio(item.envio)}`;
  }

  quitar(item: ItemCarrito) {
    this.carrito.quitar(item.id);
  }

  // ---------- Validación de los datos de envío ----------

  private largo(v: string, min: number, max: number) {
    const n = v.trim().length;
    return n >= min && n <= max;
  }

  get errores() {
    const d = this.datos;
    return {
      nombre: !this.largo(d.nombre, 3, 80),
      telefono: !/^[\d\s()+-]{6,20}$/.test(d.telefono.trim()),
      direccion: !this.largo(d.direccion, 4, 120),
      ciudad: !this.largo(d.ciudad, 2, 60),
      provincia: !PROVINCIAS.includes(d.provincia),
      codigoPostal: !/^[A-Za-z0-9]{4,8}$/.test(d.codigoPostal.trim())
    };
  }

  get datosValidos() {
    return !Object.values(this.errores).some(Boolean) && this.datos.notas.length <= 200;
  }

  irADatos() {
    this.intentoPagar.set(true);
    document.getElementById('datos-envio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('env-nombre')?.focus({ preventScroll: true }), 400);
  }

  async pagar(grupo: GrupoArtista) {
    this.error.set('');
    if (!this.auth.estaLogueado()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/carrito' } });
      return;
    }
    if (grupo.artistId.startsWith('demo-')) {
      this.error.set('Las obras de prueba no se pueden pagar. Probá con una obra real.');
      return;
    }

    this.intentoPagar.set(true);
    if (!this.datosValidos) {
      this.error.set('Completá los datos de envío para que el artista sepa a dónde mandar la obra.');
      document.getElementById('datos-envio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const envio: DatosEnvio = {
      nombre: this.datos.nombre.trim(),
      telefono: this.datos.telefono.trim(),
      direccion: this.datos.direccion.trim(),
      ciudad: this.datos.ciudad.trim(),
      provincia: this.datos.provincia,
      codigoPostal: this.datos.codigoPostal.trim().toUpperCase(),
      notas: this.datos.notas.trim()
    };
    this.guardarDatos(envio);

    this.pagando.set(grupo.artistId);
    try {
      const url = await this.pagos.iniciarPago(grupo.items.map(i => i.id), envio);
      // Se sacan del carrito: si el pago falla, Mercado Pago vuelve acá y se pueden agregar de nuevo
      grupo.items.forEach(i => this.carrito.quitar(i.id));
      window.location.href = url;
    } catch (e) {
      console.error(e);
      this.error.set(mensajeDeError(e, 'No pudimos iniciar el pago. Probá de nuevo en un rato.'));
      this.pagando.set(null);
      await this.carrito.revisar();
    }
  }

  private leerDatos(): DatosEnvio {
    const vacio: DatosEnvio = {
      nombre: this.auth?.usuario()?.displayName ?? '',
      telefono: '', direccion: '', ciudad: '', provincia: '', codigoPostal: '', notas: ''
    };
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_ENVIO) ?? 'null');
      return guardado ? { ...vacio, ...guardado } : vacio;
    } catch {
      return vacio;
    }
  }

  private guardarDatos(d: DatosEnvio) {
    try {
      localStorage.setItem(CLAVE_ENVIO, JSON.stringify(d));
    } catch {
      // Almacenamiento bloqueado: se piden de nuevo la próxima vez
    }
  }
}
