import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';

interface ObraDetalle {
  id: string;
  titulo: string;
  tecnica: string;
  anio: string;
  medida: string;
  descripcion: string;
  precio: number;
  mercadoPagoUrl: string;
  imagenUrl: string;
}

const OBRAS: ObraDetalle[] = [
  {
    id: '1',
    titulo: 'Atardecer en el campo',
    tecnica: 'Óleo sobre lienzo',
    anio: '2024',
    medida: '90 × 110 cm',
    descripcion: 'Una fuga de luz cálida sobre la tierra, con un horizonte que parece respirar lentamente. La composición sugiere calma, memoria y un paisaje íntimo, casi doméstico.',
    precio: 420000,
    mercadoPagoUrl: 'https://www.mercadopago.com.ar/',
    imagenUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '2',
    titulo: 'Retrato en azul',
    tecnica: 'Acrílico',
    anio: '2023',
    medida: '80 × 80 cm',
    descripcion: 'Un retrato contemplativo donde el azul convierte la figura en un estado emocional más que en una identidad fija. La mirada queda suspendida entre el recuerdo y la presencia.',
    precio: 320000,
    mercadoPagoUrl: 'https://www.mercadopago.com.ar/',
    imagenUrl: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '3',
    titulo: 'Formas abstractas',
    tecnica: 'Mixta sobre madera',
    anio: '2022',
    medida: '120 × 90 cm',
    descripcion: 'Fragmentos de color, trazos y materia se organizan como una conversación sin palabras. Es una pieza que invita a mirar y reconstruir la sensación antes que la forma exacta.',
    precio: 560000,
    mercadoPagoUrl: 'https://www.mercadopago.com.ar/',
    imagenUrl: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '4',
    titulo: 'Noche de piedra',
    tecnica: 'Carbonilla',
    anio: '2021',
    medida: '70 × 100 cm',
    descripcion: 'Una composición densa y serena, donde la oscuridad no es ausencia sino materia. La textura de la carbonilla da peso a cada sombra y a cada pausa.',
    precio: 260000,
    mercadoPagoUrl: 'https://www.mercadopago.com.ar/',
    imagenUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '5',
    titulo: 'Ventana de verano',
    tecnica: 'Gouache',
    anio: '2024',
    medida: '65 × 75 cm',
    descripcion: 'La luz atraviesa la composición como si pasara por una ventana abierta al sol. El color se vuelve aire, y la escena se vuelve un momento de verano detenido en el tiempo.',
    precio: 280000,
    mercadoPagoUrl: 'https://www.mercadopago.com.ar/',
    imagenUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '6',
    titulo: 'Luz sobre barro',
    tecnica: 'Óleo sobre tabla',
    anio: '2020',
    medida: '90 × 90 cm',
    descripcion: 'Una superficie terrosa atraviesa la luz con una intensidad casi escultórica. El trabajo juega con la materia, el calor del pigmento y la sensación de profundidad.',
    precio: 390000,
    mercadoPagoUrl: 'https://www.mercadopago.com.ar/',
    imagenUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '7',
    titulo: 'Párpados de humo',
    tecnica: 'Acrílico sobre lienzo',
    anio: '2023',
    medida: '85 × 110 cm',
    descripcion: 'Ondas de humo y trazos apagados crean una imagen casi etérea. La pieza se acerca a la memoria visual más que al dibujo preciso, como un sueño que apenas permanece.',
    precio: 350000,
    mercadoPagoUrl: 'https://www.mercadopago.com.ar/',
    imagenUrl: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: '8',
    titulo: 'Cuerpo de viento',
    tecnica: 'Mixta',
    anio: '2022',
    medida: '100 × 100 cm',
    descripcion: 'Un campo de movimientos que parecen fluir sin sostén. La mezcla de materiales y tonos hace que la pieza se sienta viva, como si el aire dejara en la tela su huella.',
    precio: 460000,
    mercadoPagoUrl: 'https://www.mercadopago.com.ar/',
    imagenUrl: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80',
  },
];

@Component({
  selector: 'app-detalle-obra',
  imports: [RouterLink],
  templateUrl: './detalle-obra.html',
  styleUrl: './detalle-obra.css',
})
export class DetalleObra {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(Auth);
  obra = signal<ObraDetalle | null>(null);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      const seleccionada = OBRAS.find((obra) => obra.id === id);

      if (!seleccionada) {
        this.router.navigate(['/404']);
        return;
      }

      this.obra.set(seleccionada);
    });
  }

  comprar() {
    const obraActual = this.obra();

    if (!obraActual) return;

    if (!this.auth.estaLogueado()) {
      // Al volver del login, lo traemos de nuevo a esta obra
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }

    window.open(obraActual.mercadoPagoUrl, '_blank', 'noopener,noreferrer');
  }
}
