import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Obra } from '../../core/services/artworks';

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});

@Component({
  selector: 'app-tarjeta-obra',
  imports: [RouterLink],
  templateUrl: './tarjeta-obra.html',
  styleUrl: './tarjeta-obra.css',
})
export class TarjetaObra {
  obra = input.required<Obra>();
  // En la página del artista no hace falta repetir su nombre en cada obra
  mostrarArtista = input(true);

  precio(valor: number) {
    return PESOS.format(valor);
  }
}