import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Obra {
  id: string;
  titulo: string;
  tecnica: string;
  imagenUrl: string;
}

@Component({
  selector: 'app-galeria',
  imports: [RouterLink],
  templateUrl: './galeria.html',
  styleUrl: './galeria.css',
})
export class Galeria {
  obras = signal<Obra[]>([
    { id: '1', titulo: 'Atardecer en el campo', tecnica: 'Óleo sobre lienzo', imagenUrl: '' },
    { id: '2', titulo: 'Retrato en azul', tecnica: 'Acrílico', imagenUrl: '' },
    { id: '3', titulo: 'Formas abstractas', tecnica: 'Mixta sobre madera', imagenUrl: '' },
    { id: '4', titulo: 'Noche de piedra', tecnica: 'Carbonilla', imagenUrl: '' },
    { id: '5', titulo: 'Ventana de verano', tecnica: 'Gouache', imagenUrl: '' },
    { id: '6', titulo: 'Luz sobre barro', tecnica: 'Óleo sobre tabla', imagenUrl: '' },
    { id: '7', titulo: 'Párpados de humo', tecnica: 'Acrílico sobre lienzo', imagenUrl: '' },
    { id: '8', titulo: 'Cuerpo de viento', tecnica: 'Mixta', imagenUrl: '' },
  ]);
}
