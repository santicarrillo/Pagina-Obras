import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL } from '../../../core/data/legal';

@Component({
  selector: 'app-arrepentimiento',
  imports: [RouterLink],
  templateUrl: './arrepentimiento.html',
  styleUrl: '../legal.css',
})
export class Arrepentimiento {
  readonly legal = LEGAL;

  // Abre el mail ya armado, para que el comprador solo complete los datos
  get mailArrepentimiento() {
    const asunto = 'Botón de arrepentimiento - Quiero cancelar mi compra';
    const cuerpo = [
      'Hola, quiero ejercer mi derecho de arrepentimiento.',
      '',
      'Nombre y apellido:',
      'Mail con el que compré:',
      'Número de pedido u obra:',
      'Fecha de compra:',
    ].join('\n');
    return `mailto:${this.legal.mail}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  }
}
