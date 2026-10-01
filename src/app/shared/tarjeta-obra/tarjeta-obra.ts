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

  precio(valor: number) {
    return PESOS.format(valor);
  }
}