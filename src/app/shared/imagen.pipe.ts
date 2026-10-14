import { Pipe, PipeTransform } from '@angular/core';

// Pide a Cloudinary la foto ya achicada y en el mejor formato para cada navegador
// (WebP o AVIF). Una foto de celular de 5 MB pasa a pesar unos 100-200 kB.
//   <img [src]="obra.imagenUrl | imagen: 600" />
// Las URLs que no son de Cloudinary (las obras de prueba) se devuelven tal cual.
export function imagenOptimizada(url: string | null | undefined, ancho: number): string {
  if (!url) return '';
  const marca = '/image/upload/';
  const i = url.indexOf(marca);
  if (!url.startsWith('https://res.cloudinary.com/') || i === -1) return url;
  const despues = url.slice(i + marca.length);
  // Si ya tiene transformaciones, no se agregan otras
  if (/^(f_|q_|w_|c_)/.test(despues)) return url;
  return `${url.slice(0, i + marca.length)}f_auto,q_auto,c_limit,w_${Math.round(ancho)}/${despues}`;
}

@Pipe({ name: 'imagen' })
export class ImagenPipe implements PipeTransform {
  transform(url: string | null | undefined, ancho = 800): string {
    return imagenOptimizada(url, ancho);
  }
}
