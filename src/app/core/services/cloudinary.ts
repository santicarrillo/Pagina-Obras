import { Injectable } from '@angular/core';
import { CLOUDINARY_CONFIG } from '../services/config';

@Injectable({ providedIn: 'root' })
export class Cloudinary {

  async subirImagen(archivo: File): Promise<string> {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    const respuesta = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!respuesta.ok) {
      throw new Error('No se pudo subir la imagen');
    }

    const datos = await respuesta.json();
    return datos.secure_url as string;
  }
}