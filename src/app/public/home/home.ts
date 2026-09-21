import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ObraDestacada {
  id: string;
  titulo: string;
  tecnica: string;
  imagenUrl: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  // Datos de prueba — cuando conectemos ArtworksService esto sale de Firestore
  obras = signal<ObraDestacada[]>([
    { id: '1', titulo: 'Atardecer en el campo', tecnica: 'Óleo sobre lienzo', imagenUrl: '' },
    { id: '2', titulo: 'Retrato en azul', tecnica: 'Acrílico', imagenUrl: '' },
    { id: '3', titulo: 'Formas abstractas', tecnica: 'Mixta sobre madera', imagenUrl: '' },
  ]);

  @ViewChild('tira') tira!: ElementRef<HTMLElement>;

  anterior() {
    this.tira.nativeElement.scrollBy({ left: -this.tira.nativeElement.clientWidth, behavior: 'smooth' });
  }

  siguiente() {
    this.tira.nativeElement.scrollBy({ left: this.tira.nativeElement.clientWidth, behavior: 'smooth' });
  }
  ngAfterViewInit() {
    this.tira.nativeElement.addEventListener('wheel', (evento: WheelEvent) => {
      if (evento.deltaY !== 0) {
        evento.preventDefault();
        this.tira.nativeElement.scrollBy({ left: evento.deltaY, behavior: 'smooth' });
      }
    }, { passive: false });
  }
}