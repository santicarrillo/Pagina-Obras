import { isDevMode } from '@angular/core';
import { Obra } from '../services/artworks';

// Obras de prueba para testear el diseño mientras desarrollás.
// Solo aparecen con `ng serve`: en la versión publicada (`ng deploy`)
// isDevMode() es false y la lista queda vacía, sin tener que borrar nada.

function demo(
  n: number, titulo: string, artistaNombre: string, tecnica: string,
  medidas: string, anio: number, precio: number, descripcion: string, foto: string
): Obra {
  return {
    id: `demo-${n}`,
    artistId: `demo-artista-${artistaNombre}`,
    artistaNombre, titulo, tecnica, medidas, anio, precio, descripcion,
    imagenUrl: `https://images.unsplash.com/${foto}?auto=format&fit=crop&w=900&q=80`,
    estado: 'publicada',
    creadoEn: null
  };
}

const DEMO: Obra[] = [
  demo(1, 'Atardecer en el campo', 'Lucía Ferraro', 'Óleo sobre lienzo', '90 × 110 cm', 2024, 420000,
    'Una fuga de luz cálida sobre la tierra, con un horizonte que parece respirar lentamente. La composición sugiere calma, memoria y un paisaje íntimo.',
    'photo-1460661419201-fd4cecdf8a8b'),
  demo(2, 'Retrato en azul', 'Tomás Ibarra', 'Acrílico', '80 × 80 cm', 2023, 320000,
    'Un retrato contemplativo donde el azul convierte la figura en un estado emocional más que en una identidad fija.',
    'photo-1515405295579-ba7b45403062'),
  demo(3, 'Formas abstractas', 'Lucía Ferraro', 'Mixta sobre madera', '120 × 90 cm', 2022, 560000,
    'Fragmentos de color, trazos y materia se organizan como una conversación sin palabras.',
    'photo-1545239351-1141bd82e8a6'),
  demo(4, 'Noche de piedra', 'Martina Sosa', 'Carbonilla', '70 × 100 cm', 2021, 260000,
    'Una composición densa y serena, donde la oscuridad no es ausencia sino materia.',
    'photo-1500530855697-b586d89ba3ee'),
  demo(5, 'Luz sobre barro', 'Tomás Ibarra', 'Óleo sobre tabla', '90 × 90 cm', 2020, 390000,
    'Una superficie terrosa atraviesa la luz con una intensidad casi escultórica. El trabajo juega con la materia y el calor del pigmento.',
    'photo-1579783902614-a3fb3927b6a5'),
  demo(6, 'Cuerpo de viento', 'Martina Sosa', 'Mixta', '100 × 100 cm', 2022, 460000,
    'Un campo de movimientos que parecen fluir sin sostén, como si el aire dejara en la tela su huella.',
    'photo-1541961017774-22349e4a1262')
];

export const OBRAS_DEMO: Obra[] = isDevMode() ? DEMO : [];
