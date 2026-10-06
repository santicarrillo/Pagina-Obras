// Redes sociales del artista: hasta 5, de las que tenga (no se le obliga ninguna).

export type TipoRed = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'web' | 'otra';

export interface Red {
  tipo: TipoRed;
  url: string;   // siempre un link completo https://...
}

export const MAX_REDES = 5;

export const TIPOS_RED: { tipo: TipoRed; nombre: string; ejemplo: string }[] = [
  { tipo: 'instagram', nombre: 'Instagram', ejemplo: '@tuusuario' },
  { tipo: 'facebook', nombre: 'Facebook', ejemplo: 'tu usuario o el link a tu página' },
  { tipo: 'tiktok', nombre: 'TikTok', ejemplo: '@tuusuario' },
  { tipo: 'youtube', nombre: 'YouTube', ejemplo: '@tucanal o el link' },
  { tipo: 'web', nombre: 'Sitio web', ejemplo: 'www.tusitio.com' },
  { tipo: 'otra', nombre: 'Otra', ejemplo: 'link completo' }
];

export function nombreRed(tipo: TipoRed) {
  return TIPOS_RED.find(t => t.tipo === tipo)?.nombre ?? 'Link';
}

// Convierte lo que escribió el artista (un @usuario o un link) en un link completo.
// Devuelve null si no se puede armar un link válido.
export function armarUrl(tipo: TipoRed, valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;

  if (/^https?:\/\//i.test(v)) return esLinkSeguro(v) ? v : null;

  const usuario = v.replace(/^@/, '');
  const esUsuario = /^[A-Za-z0-9._-]{1,60}$/.test(usuario);
  const bases: Partial<Record<TipoRed, string>> = {
    instagram: 'https://instagram.com/',
    facebook: 'https://facebook.com/',
    tiktok: 'https://www.tiktok.com/@',
    youtube: 'https://www.youtube.com/@'
  };
  if (bases[tipo] && esUsuario) return bases[tipo] + usuario;

  // Sitio web u otra: se le agrega https:// si lo escribieron sin
  const conProtocolo = `https://${v.replace(/^\/+/, '')}`;
  return esLinkSeguro(conProtocolo) && /\.[a-z]{2,}/i.test(conProtocolo) ? conProtocolo : null;
}

// Solo links http(s) bien formados: nada de "javascript:" ni cosas raras
export function esLinkSeguro(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && url.length <= 300;
  } catch {
    return false;
  }
}

// Lo que se muestra en pantalla: "@usuario" para redes, el dominio para webs
export function textoRed(red: Red): string {
  try {
    const u = new URL(red.url);
    const camino = u.pathname.replace(/\/+$/, '');
    if (['instagram', 'tiktok', 'facebook', 'youtube'].includes(red.tipo) && camino.split('/').length === 2) {
      return '@' + camino.slice(1).replace(/^@/, '');
    }
    return u.hostname.replace(/^www\./, '') + (camino && red.tipo !== 'web' ? camino : '');
  } catch {
    return red.url;
  }
}

// Perfiles viejos solo tenían "instagram": se pasa a la lista nueva
export function redesDesde(data: { redes?: unknown; instagram?: unknown }): Red[] {
  if (Array.isArray(data.redes)) {
    return data.redes
      .filter((r: any) => r && typeof r.url === 'string' && esLinkSeguro(r.url))
      .slice(0, MAX_REDES)
      .map((r: any) => ({ tipo: TIPOS_RED.some(t => t.tipo === r.tipo) ? r.tipo : 'otra', url: r.url }));
  }
  if (typeof data.instagram === 'string' && data.instagram.trim()) {
    const url = armarUrl('instagram', data.instagram);
    return url ? [{ tipo: 'instagram', url }] : [];
  }
  return [];
}
