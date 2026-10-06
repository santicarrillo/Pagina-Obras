import { isDevMode } from '@angular/core';
import type { Obra } from '../services/artworks';
import type { Artista } from '../services/artistas';

// Artistas y obras de prueba para testear el diseño mientras desarrollás.
// Solo aparecen con `ng serve`: en la versión publicada (`ng deploy`)
// isDevMode() es false y las listas quedan vacías, sin tener que borrar nada.

const ARTISTAS: Artista[] = [
  {
    id: 'demo-lucia', nombreArtistico: 'Lucía Ferraro', ciudad: 'Tandil',
    redes: [
      { tipo: 'instagram', url: 'https://instagram.com/luciaferraro.arte' },
      { tipo: 'web', url: 'https://luciaferraro.com.ar' }
    ],
    bio: 'Pinto paisajes de la llanura y formas que salen de mirar mucho tiempo la misma luz. Trabajo con óleo y técnicas mixtas sobre madera.'
  },
  {
    id: 'demo-tomas', nombreArtistico: 'Tomás Ibarra', ciudad: 'Rosario', redes: [],
    bio: 'Retratos y superficies. Me interesa el color como estado de ánimo más que como descripción.'
  },
  {
    id: 'demo-martina', nombreArtistico: 'Martina Sosa', ciudad: 'Córdoba',
    redes: [
      { tipo: 'instagram', url: 'https://instagram.com/martinasosa' },
      { tipo: 'tiktok', url: 'https://www.tiktok.com/@martinasosa' },
      { tipo: 'youtube', url: 'https://www.youtube.com/@martinasosa' }
    ],
    bio: 'Dibujo con carbonilla y materiales encontrados. Cada obra empieza en un cuaderno de viaje.'
  }
];

function obra(
  n: number, artista: Artista, titulo: string, tecnica: string,
  medidas: string, anio: number, precio: number, descripcion: string, foto: string
): Obra {
  return {
    id: `demo-${n}`,
    artistId: artista.id,
    artistaNombre: artista.nombreArtistico,
    titulo, tecnica, medidas, anio, precio, descripcion,
    envio: n % 3 === 0 ? 0 : 6500,
    imagenUrl: `https://images.unsplash.com/${foto}?auto=format&fit=crop&w=900&q=80`,
    estado: 'publicada',
    creadoEn: null
  };
}

const [lucia, tomas, martina] = ARTISTAS;

const OBRAS: Obra[] = [
  obra(1, lucia, 'Atardecer en el campo', 'Óleo sobre lienzo', '90 × 110 cm', 2024, 420000,
    'Una fuga de luz cálida sobre la tierra, con un horizonte que parece respirar lentamente. La composición sugiere calma, memoria y un paisaje íntimo.',
    'photo-1460661419201-fd4cecdf8a8b'),
  obra(2, tomas, 'Retrato en azul', 'Acrílico', '80 × 80 cm', 2023, 320000,
    'Un retrato contemplativo donde el azul convierte la figura en un estado emocional más que en una identidad fija.',
    'photo-1515405295579-ba7b45403062'),
  obra(3, lucia, 'Formas abstractas', 'Mixta sobre madera', '120 × 90 cm', 2022, 560000,
    'Fragmentos de color, trazos y materia se organizan como una conversación sin palabras.',
    'photo-1545239351-1141bd82e8a6'),
  obra(4, martina, 'Noche de piedra', 'Carbonilla', '70 × 100 cm', 2021, 260000,
    'Una composición densa y serena, donde la oscuridad no es ausencia sino materia.',
    'photo-1500530855697-b586d89ba3ee'),
  obra(5, tomas, 'Luz sobre barro', 'Óleo sobre tabla', '90 × 90 cm', 2020, 390000,
    'Una superficie terrosa atraviesa la luz con una intensidad casi escultórica.',
    'photo-1579783902614-a3fb3927b6a5'),
  obra(6, martina, 'Cuerpo de viento', 'Mixta', '100 × 100 cm', 2022, 460000,
    'Un campo de movimientos que parecen fluir sin sostén, como si el aire dejara en la tela su huella.',
    'photo-1541961017774-22349e4a1262'),
  obra(7, lucia, 'Siesta en la sierra', 'Óleo sobre lienzo', '60 × 80 cm', 2024, 310000,
    'Las sierras de Tandil a la hora en que todo se queda quieto.',
    'photo-1578301978693-85fa9c0320b9'),
  obra(8, lucia, 'Trigo', 'Acrílico sobre tela', '50 × 70 cm', 2023, 240000,
    'Un estudio de amarillos que empezó como boceto y terminó siendo cuadro.',
    'photo-1549887534-1541e9326642'),
  obra(9, lucia, 'Ventana de verano', 'Gouache', '65 × 75 cm', 2024, 280000,
    'La luz atraviesa la composición como si pasara por una ventana abierta al sol.',
    'photo-1547891654-e66ed7ebb968')
];

export const ARTISTAS_DEMO: Artista[] = isDevMode() ? ARTISTAS : [];
export const OBRAS_DEMO: Obra[] = isDevMode() ? OBRAS : [];
