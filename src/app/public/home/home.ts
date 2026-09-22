import { AfterViewInit, Component, ElementRef, HostListener, ViewChild, signal } from '@angular/core';
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
export class Home implements AfterViewInit {
  // Datos de prueba — cuando conectemos ArtworksService esto sale de Firestore
  obras = signal<ObraDestacada[]>([
    { id: '1', titulo: 'Atardecer en el campo', tecnica: 'Óleo sobre lienzo', imagenUrl: '' },
    { id: '2', titulo: 'Retrato en azul', tecnica: 'Acrílico', imagenUrl: '' },
    { id: '3', titulo: 'Formas abstractas', tecnica: 'Mixta sobre madera', imagenUrl: '' },
  ]);

  mostrarIzq = signal(false);
  mostrarDer = signal(true);

  @ViewChild('tira') tira!: ElementRef<HTMLElement>;

  anterior() {
    const elemento = this.tira.nativeElement;
    elemento.scrollBy({ left: -elemento.clientWidth, behavior: 'smooth' });
    setTimeout(() => this.actualizarFlechas(), 80);
  }

  siguiente() {
    const elemento = this.tira.nativeElement;
    elemento.scrollBy({ left: elemento.clientWidth, behavior: 'smooth' });
    setTimeout(() => this.actualizarFlechas(), 80);
  }

  @HostListener('window:resize')
  actualizarFlechas() {
    const elemento = this.tira?.nativeElement;
    if (!elemento) {
      return;
    }

    const maxScroll = Math.max(0, elemento.scrollWidth - elemento.clientWidth);
    const inicio = elemento.scrollLeft <= 2;
    const final = maxScroll <= 2 || elemento.scrollLeft >= maxScroll - 2;

    this.mostrarIzq.set(!inicio);
    this.mostrarDer.set(!final);
  }

  ngAfterViewInit() {
    const elemento = this.tira.nativeElement;
    elemento.scrollLeft = 0;
    requestAnimationFrame(() => {
      elemento.scrollTo({ left: 0, behavior: 'auto' });
      this.actualizarFlechas();
    });

    elemento.addEventListener('scroll', () => this.actualizarFlechas(), { passive: true });
  }
}