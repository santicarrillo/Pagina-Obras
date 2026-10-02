import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';

interface Pregunta {
  pregunta: string;
  respuesta: string;
}

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  auth = inject(Auth);

  readonly email = 'santiago03carrillo@gmail.com';
  readonly anio = new Date().getFullYear();

  // Para cambiar o sumar preguntas, editá esta lista
  readonly preguntas: Pregunta[] = [
    {
      pregunta: '¿Cómo compro una obra?',
      respuesta: 'Elegí la obra en la galería, entrá a su página y tocá "Comprar". Te vamos a pedir que inicies sesión antes de pagar.'
    },
    {
      pregunta: '¿Las obras son originales?',
      respuesta: 'Sí. Cada obra es única: cuando alguien la compra, deja de estar a la venta.'
    },
    {
      pregunta: '¿Cómo vendo mis obras?',
      respuesta: 'Entrá a "Quiero vender", armá tu perfil de artista y subí la foto de cada obra con su precio. Aparece en la galería al instante.'
    },
    {
      pregunta: '¿Dónde veo mis compras?',
      respuesta: 'En el menú de tu usuario, arriba a la derecha, en "Mis pedidos".'
    }
  ];
}
