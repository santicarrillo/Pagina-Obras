// Backend de Anverso: conexión de artistas con Mercado Pago, creación de pagos
// y confirmación automática de ventas.
//
// Modelo marketplace: cada artista conecta SU cuenta de Mercado Pago (OAuth)
// y la plata de cada venta le llega directo. Anverso puede quedarse con una
// comisión (COMISION_PORCENTAJE en functions/.env), hoy en 0.

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret, defineString, defineInt } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const nodemailer = require('nodemailer');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const crypto = require('node:crypto');

initializeApp();
const db = getFirestore();

const REGION = 'southamerica-east1'; // San Pablo: la más cercana a Argentina
setGlobalOptions({ region: REGION, maxInstances: 5 });

const MP_CLIENT_ID = defineString('MP_CLIENT_ID');
const MP_CLIENT_SECRET = defineSecret('MP_CLIENT_SECRET');
const WEB_URL = defineString('WEB_URL');
const COMISION_PORCENTAJE = defineInt('COMISION_PORCENTAJE', { default: 0 });

// Mails: se mandan desde una cuenta de Gmail con "contraseña de aplicación".
// SMTP_USER va en functions/.env; la contraseña es secreta (firebase functions:secrets:set SMTP_PASS)
const SMTP_USER = defineString('SMTP_USER', { default: '' });
const SMTP_PASS = defineSecret('SMTP_PASS');

const PROYECTO = process.env.GCLOUD_PROJECT || 'paginaparacomprasdeobras';
const BASE_FUNCIONES = `https://${REGION}-${PROYECTO}.cloudfunctions.net`;
const REDIRECT_URI = `${BASE_FUNCIONES}/mpOauthCallback`;
const MP_API = 'https://api.mercadopago.com';

// Colecciones
//   mp_cuentas/{uid}       tokens del artista (PRIVADO: las reglas no dejan leerlo desde el navegador)
//   pagos_artistas/{uid}   { conectado: true } público, para saber si un artista puede cobrar
//   mp_oauth_states/{id}   estado temporal mientras el artista autoriza en Mercado Pago
//   orders/{id}            pedidos (los crea y actualiza solo este backend)

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

// Se limpian espacios, saltos de línea y comillas que se cuelan al copiar y pegar
const limpiar = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '').trim();
const clientId = () => limpiar(MP_CLIENT_ID.value());
const clientSecret = () => limpiar(MP_CLIENT_SECRET.value());

const PESOS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Plantilla de mail simple, con la estética de la página
function plantillaMail(titulo, parrafos, boton) {
  const cuerpo = parrafos.map(p => `<p style="margin:0 0 14px;line-height:1.6;color:#3b342b">${p}</p>`).join('');
  const link = boton
    ? `<p style="margin:24px 0 0"><a href="${boton.url}" style="background:#2b241b;color:#f4ebdf;padding:12px 20px;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase">${escapar(boton.texto)}</a></p>`
    : '';
  return `<div style="background:#f6f1ea;padding:32px 16px;font-family:Georgia,serif">
    <div style="max-width:520px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e6dccd">
      <p style="margin:0 0 24px;letter-spacing:4px;font-size:14px;color:#2b241b"><strong>ANVERSO</strong></p>
      <h1 style="margin:0 0 18px;font-weight:normal;font-size:24px;color:#2b241b">${escapar(titulo)}</h1>
      ${cuerpo}${link}
    </div></div>`;
}

// Si el mail no está configurado o falla, se registra y se sigue: un mail nunca frena una venta
async function enviarMail(para, asunto, html) {
  if (!para) return;
  const user = limpiar(SMTP_USER.value());
  let pass = '';
  try { pass = limpiar(SMTP_PASS.value()).replace(/\s/g, ''); } catch { pass = ''; }
  if (!user || !pass) {
    logger.warn('Mails no configurados: no se envió', { asunto });
    return;
  }
  try {
    const transporte = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await transporte.sendMail({ from: `Anverso <${user}>`, to: para, subject: asunto, html });
  } catch (e) {
    logger.error('No se pudo enviar el mail', { asunto, error: e.message });
  }
}

// Siempre el mail real de la cuenta (Firebase Auth), nunca uno escrito a mano en la ficha
async function emailDe(uid) {
  try {
    return (await getAuth().getUser(uid)).email ?? null;
  } catch {
    return null;
  }
}

// Resumen de un error de Mercado Pago para los logs: sin datos del pagador
function resumenMp(e) {
  return {
    error: e?.message,
    status: e?.status ?? null,
    codigo: e?.datos?.error ?? e?.datos?.code ?? null,
    detalle: typeof e?.datos?.message === 'string' ? e.datos.message.slice(0, 200) : null
  };
}

// Fecha en el formato que pide Mercado Pago, en hora argentina (2026-10-14T18:00:00.000-03:00)
function fechaMp(ms) {
  return new Date(ms - 3 * 3600 * 1000).toISOString().replace('Z', '-03:00');
}

function listaObras(orden) {
  return (orden.items ?? []).map(i => `<em>${escapar(i.titulo)}</em>`).join(', ');
}

async function mpFetch(ruta, { token, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${MP_API}${ruta}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = { raw: texto }; }
  if (!res.ok) {
    const err = new Error(`Mercado Pago respondió ${res.status} en ${ruta}`);
    err.status = res.status;
    err.datos = datos;
    throw err;
  }
  return datos;
}

function guardarTokens(uid, t) {
  return db.doc(`mp_cuentas/${uid}`).set({
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    mpUserId: t.user_id ?? null,
    publicKey: t.public_key ?? null,
    liveMode: t.live_mode ?? null,
    expiraEn: Timestamp.fromMillis(Date.now() + (t.expires_in ?? 15552000) * 1000),
    actualizadoEn: FieldValue.serverTimestamp()
  }, { merge: true });
}

// Si Mercado Pago revocó el acceso (o no se pudo renovar a tiempo), el artista deja de figurar
// como "puede cobrar" y le avisamos para que vuelva a conectar su cuenta.
async function marcarDesconectado(uid, motivo) {
  const ref = db.doc(`pagos_artistas/${uid}`);
  const antes = await ref.get();
  if (antes.exists && antes.data().conectado === false) return; // ya estaba avisado
  await ref.set({ conectado: false, desconectadoEn: FieldValue.serverTimestamp(), motivo }, { merge: true });
  logger.warn('Artista desconectado de Mercado Pago', { uid, motivo });
  await enviarMail(await emailDe(uid), 'Volvé a conectar tu Mercado Pago — Anverso', plantillaMail(
    'Tu Mercado Pago se desconectó',
    ['Mercado Pago dejó de autorizar a Anverso a cobrar en tu nombre. Mientras tanto tus obras se ven, pero no se pueden comprar.',
     'Entrá a "Mis obras" y tocá "Conectar" para volver a conectarla. Es un minuto.'],
    { texto: 'Ir a mis obras', url: `${WEB_URL.value()}/admin/obras` }
  ));
}

// Devuelve el access token del artista, renovándolo si está por vencer
async function tokenDelArtista(uid) {
  const snap = await db.doc(`mp_cuentas/${uid}`).get();
  if (!snap.exists) return null;
  const cuenta = snap.data();
  const venceEn = cuenta.expiraEn?.toMillis?.() ?? 0; // sin fecha = renovar
  const faltaPoco = venceEn - Date.now() < 7 * 24 * 3600 * 1000;
  if (!faltaPoco) return cuenta.accessToken;

  try {
    const t = await mpFetch('/oauth/token', {
      method: 'POST',
      body: {
        client_id: clientId(),
        client_secret: clientSecret(),
        grant_type: 'refresh_token',
        refresh_token: cuenta.refreshToken
      }
    });
    await guardarTokens(uid, t);
    // Si había quedado marcado como desconectado, vuelve a poder cobrar
    await db.doc(`pagos_artistas/${uid}`).set({ conectado: true }, { merge: true });
    return t.access_token;
  } catch (e) {
    logger.error('No se pudo renovar el token del artista', { uid, ...resumenMp(e) });
    // Solo "invalid_grant" significa que Mercado Pago revocó el acceso. Un error de red,
    // un 5xx o un problema con nuestras credenciales no desconecta al artista.
    if (e?.datos?.error === 'invalid_grant') {
      await marcarDesconectado(uid, 'revocado');
      return null;
    }
    const vencido = cuenta.expiraEn && venceEn <= Date.now();
    return vencido ? null : cuenta.accessToken;
  }
}

// Datos de envío que manda el comprador. Se validan y se recortan acá: no se confía en el navegador.
const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

function validarEnvio(e) {
  const txt = (v, min, max) => {
    const t = typeof v === 'string' ? v.trim() : '';
    return t.length >= min && t.length <= max ? t : null;
  };
  const datos = {
    nombre: txt(e?.nombre, 3, 80),
    telefono: txt(e?.telefono, 6, 20),
    direccion: txt(e?.direccion, 4, 120),
    ciudad: txt(e?.ciudad, 2, 60),
    provincia: PROVINCIAS.includes(e?.provincia) ? e.provincia : null,
    codigoPostal: txt(e?.codigoPostal, 4, 8),
    notas: typeof e?.notas === 'string' ? e.notas.trim().slice(0, 200) : ''
  };
  const falta = Object.entries(datos).find(([k, v]) => k !== 'notas' && v === null);
  if (falta || !/^[\d\s()+-]+$/.test(datos.telefono) || !/^[A-Za-z0-9]+$/.test(datos.codigoPostal)) {
    throw new HttpsError('invalid-argument', 'Revisá los datos de envío.');
  }
  datos.codigoPostal = datos.codigoPostal.toUpperCase();
  return datos;
}

function exigirLogin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Tenés que iniciar sesión.');
  return request.auth;
}

// ---------------------------------------------------------------------------
// 1) El artista pide conectar su Mercado Pago: devolvemos la URL de autorización
// ---------------------------------------------------------------------------

exports.mpConectarUrl = onCall(async (request) => {
  const { uid } = exigirLogin(request);

  const artista = await db.doc(`artists/${uid}`).get();
  if (!artista.exists) {
    throw new HttpsError('failed-precondition', 'Primero tenés que activar tu perfil de artista.');
  }

  const state = crypto.randomBytes(24).toString('hex');
  await db.doc(`mp_oauth_states/${state}`).set({ uid, creadoEn: FieldValue.serverTimestamp() });
  logger.info('Link de conexión creado', { uid });

  const url = new URL('https://auth.mercadopago.com.ar/authorization');
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('platform_id', 'mp');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  return { url: url.toString() };
});

// ---------------------------------------------------------------------------
// 2) Mercado Pago vuelve acá después de que el artista autoriza
// ---------------------------------------------------------------------------

exports.mpOauthCallback = onRequest({ secrets: [MP_CLIENT_SECRET] }, async (req, res) => {
  const volver = (resultado) => res.redirect(`${WEB_URL.value()}/admin/obras?mp=${resultado}`);
  const { code, state, error } = req.query;
  // Se registra qué llegó (sin los valores, que son privados) para poder diagnosticar
  logger.info('Vuelta de Mercado Pago', {
    parametros: Object.keys(req.query),
    tieneCode: !!code,
    tieneState: !!state,
    error: error ?? null
  });

  if (error || !code || !state) {
    logger.warn('OAuth cancelado o incompleto', { error });
    return volver('cancelado');
  }

  try {
    if (!/^[a-f0-9]{48}$/.test(String(state))) return volver('error');
    const stateRef = db.doc(`mp_oauth_states/${String(state)}`);
    // Se lee y se borra en una transacción: el mismo link no se puede usar dos veces
    const datosState = await db.runTransaction(async (tx) => {
      const s = await tx.get(stateRef);
      if (!s.exists) return null;
      tx.delete(stateRef);
      return s.data();
    });
    if (!datosState) {
      logger.warn('State inexistente: link ya usado o inválido');
      return volver('error');
    }
    const { uid, creadoEn } = datosState;

    // El link de autorización vale 15 minutos
    if (!creadoEn || Date.now() - creadoEn.toMillis() > 15 * 60 * 1000) {
      logger.warn('Link de autorización vencido', { uid });
      return volver('vencido');
    }

    const t = await mpFetch('/oauth/token', {
      method: 'POST',
      body: {
        client_id: clientId(),
        client_secret: clientSecret(),
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      }
    });

    await guardarTokens(uid, t);
    await db.doc(`pagos_artistas/${uid}`).set({
      conectado: true,
      conectadoEn: FieldValue.serverTimestamp()
    });
    logger.info('Artista conectado a Mercado Pago', { uid });
    return volver('conectado');
  } catch (e) {
    logger.error('Error en OAuth de Mercado Pago', resumenMp(e));
    return volver('error');
  }
});

// ---------------------------------------------------------------------------
// Dejar de ser artista: pausa sus obras, borra su perfil y desconecta Mercado Pago.
// Los pedidos y ventas NO se tocan: compradores y artista conservan su historial.
// ---------------------------------------------------------------------------

// Ventas que todavía necesitan al artista: pagadas sin entregar, o un pago que alguien
// empezó hace menos de 2 horas (el link de pago vence a la hora).
async function ventasSinTerminar(uid) {
  const snap = await db.collection('orders')
    .where('artistId', '==', uid)
    .where('estado', 'in', ['pendiente', 'pagado', 'conflicto'])
    .get();
  const hace2Horas = Date.now() - 2 * 3600 * 1000;
  return snap.docs.filter(d => {
    const o = d.data();
    if (o.estado === 'pagado') return o.envioEstado !== 'entregado';
    if (o.estado === 'conflicto') return !o.reembolsoId; // una devolución todavía pendiente
    // Un pago en efectivo (Rapipago, Pago Fácil) o en revisión se puede aprobar días después
    if (['pending', 'in_process'].includes(o.pagoEstado)) return true;
    return (o.creadoEn?.toMillis?.() ?? 0) > hace2Horas;
  }).length;
}

async function bajaDeArtista(uid) {
  const pendientes = await ventasSinTerminar(uid);
  if (pendientes > 0) {
    throw new HttpsError('failed-precondition',
      `Tenés ${pendientes === 1 ? 'una venta' : pendientes + ' ventas'} sin terminar. ` +
      'Marcalas como entregadas en "Mis ventas" antes de darte de baja. Si alguien está pagando, esperá un par de horas.');
  }

  const publicadas = await db.collection('artworks')
    .where('artistId', '==', uid)
    .where('estado', '==', 'publicada')
    .get();
  // Un lote de Firestore admite hasta 500 cambios: se pausan de a 400
  for (let i = 0; i < publicadas.docs.length; i += 400) {
    const lote = db.batch();
    publicadas.docs.slice(i, i + 400).forEach(d => lote.update(d.ref, { estado: 'pausada' }));
    await lote.commit();
  }

  const batch = db.batch();
  batch.delete(db.doc(`artists/${uid}`));
  batch.delete(db.doc(`pagos_artistas/${uid}`));
  batch.delete(db.doc(`mp_cuentas/${uid}`));
  await batch.commit();
  return publicadas.size;
}

exports.dejarDeSerArtista = onCall(async (request) => {
  const { uid } = exigirLogin(request);
  const obrasPausadas = await bajaDeArtista(uid);
  logger.info('Dejó de ser artista', { uid, obrasPausadas });
  return { obrasPausadas };
});

// Eliminar la cuenta: lo mismo que dejar de ser artista, más sus datos personales y el acceso.
// Los pedidos quedan, porque la otra parte de cada compra los necesita.
exports.eliminarCuenta = onCall(async (request) => {
  const { uid } = exigirLogin(request);
  await bajaDeArtista(uid);
  await db.doc(`users/${uid}`).delete();
  await getAuth().deleteUser(uid);
  logger.info('Cuenta eliminada', { uid });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// 3) El comprador paga: creamos el pedido y la preferencia de pago
//    Cada pago es para UN artista (la plata va a su cuenta).
// ---------------------------------------------------------------------------

exports.crearPago = onCall({ secrets: [MP_CLIENT_SECRET, SMTP_PASS] }, async (request) => {
  const auth = exigirLogin(request);
  const obraIds = request.data?.obraIds;

  if (!Array.isArray(obraIds) || obraIds.length === 0 || obraIds.length > 20 ||
      !obraIds.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id))) {
    throw new HttpsError('invalid-argument', 'Lista de obras inválida.');
  }
  const ids = [...new Set(obraIds)];
  const envio = validarEnvio(request.data?.envio);

  // Freno contra pedidos basura: como mucho 5 pagos sin terminar por hora
  const misPendientes = await db.collection('orders')
    .where('buyerId', '==', auth.uid)
    .where('estado', '==', 'pendiente')
    .get();
  const haceUnaHora = Date.now() - 3600 * 1000;
  const recientes = misPendientes.docs.filter(d => (d.data().creadoEn?.toMillis?.() ?? 0) > haceUnaHora).length;
  if (recientes >= 5) {
    throw new HttpsError('failed-precondition', 'Tenés varios pagos empezados sin terminar. Esperá un rato y probá de nuevo.');
  }

  // Se leen las obras del servidor: los precios del navegador no se usan nunca
  const snaps = await Promise.all(ids.map(id => db.doc(`artworks/${id}`).get()));
  const obras = snaps.map(s => (s.exists ? { id: s.id, ...s.data() } : null));

  if (obras.some(o => !o || o.estado !== 'publicada')) {
    throw new HttpsError('failed-precondition', 'Alguna de las obras ya no está disponible. Revisá tu carrito.');
  }
  const artistId = obras[0].artistId;
  if (obras.some(o => o.artistId !== artistId)) {
    throw new HttpsError('invalid-argument', 'Cada pago tiene que ser de obras de un mismo artista.');
  }
  if (artistId === auth.uid) {
    throw new HttpsError('failed-precondition', 'No podés comprar tus propias obras.');
  }

  const token = await tokenDelArtista(artistId);
  if (!token) {
    throw new HttpsError('failed-precondition', 'Este artista todavía no puede recibir pagos.');
  }

  const subtotal = obras.reduce((s, o) => s + o.precio, 0);
  // Envío fijo que puso el artista en cada obra (las obras viejas sin envío: a coordinar, $0)
  const costoEnvio = obras.reduce((s, o) => s + (Number.isInteger(o.envio) && o.envio > 0 ? o.envio : 0), 0);
  const envioACoordinar = obras.some(o => !Number.isInteger(o.envio));
  const total = subtotal + costoEnvio;
  // La comisión de Anverso es solo sobre las obras, nunca sobre el envío
  const comision = Math.round((subtotal * COMISION_PORCENTAJE.value()) / 100);

  // El link de pago vence en una hora: así nadie paga más tarde un precio viejo
  const venceEn = Date.now() + 60 * 60 * 1000;

  const ordenRef = db.collection('orders').doc();
  await ordenRef.set({
    buyerId: auth.uid,
    buyerEmail: auth.token.email ?? null,
    buyerNombre: auth.token.name ?? null,
    artistId,
    artistaNombre: obras[0].artistaNombre ?? '',
    // El contacto del artista se agrega recién cuando el pago se aprueba (confirmarVenta)
    artistaContacto: null,
    obraIds: ids,
    items: obras.map(o => ({
      id: o.id, titulo: o.titulo, precio: o.precio, imagenUrl: o.imagenUrl, tecnica: o.tecnica ?? '',
      envio: Number.isInteger(o.envio) ? o.envio : null
    })),
    subtotal,
    costoEnvio,
    envioACoordinar,
    envio,
    total,
    comision,
    estado: 'pendiente',
    creadoEn: FieldValue.serverTimestamp(),
    venceEn: Timestamp.fromMillis(venceEn)
  });

  const web = WEB_URL.value();
  try {
    const pref = await mpFetch('/checkout/preferences', {
      token,
      method: 'POST',
      body: {
        items: obras.map(o => ({
          id: o.id,
          title: o.titulo,
          description: `${o.tecnica ?? ''} — ${o.artistaNombre ?? ''}`.slice(0, 250),
          picture_url: o.imagenUrl,
          category_id: 'art',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: o.precio
        })).concat(costoEnvio > 0 ? [{
          id: 'envio',
          title: 'Envío',
          description: `A ${envio.ciudad}, ${envio.provincia}`.slice(0, 250),
          category_id: 'services',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: costoEnvio
        }] : []),
        payer: auth.token.email ? { email: auth.token.email } : undefined,
        external_reference: ordenRef.id,
        notification_url: `${BASE_FUNCIONES}/mpWebhook?orden=${ordenRef.id}`,
        back_urls: {
          success: `${web}/mis-pedidos?pago=ok`,
          pending: `${web}/mis-pedidos?pago=pendiente`,
          failure: `${web}/carrito?pago=error`
        },
        auto_return: 'approved',
        statement_descriptor: 'ANVERSO',
        expires: true,
        expiration_date_from: fechaMp(Date.now() - 60 * 1000),
        expiration_date_to: fechaMp(venceEn),
        ...(comision > 0 ? { marketplace_fee: comision } : {})
      }
    });

    await ordenRef.update({ preferenciaId: pref.id });
    return { url: pref.init_point, ordenId: ordenRef.id };
  } catch (e) {
    logger.error('No se pudo crear la preferencia', { orden: ordenRef.id, ...resumenMp(e) });
    await ordenRef.update({ estado: 'error' });
    if (e?.status === 401) {
      await marcarDesconectado(artistId, 'revocado');
      throw new HttpsError('failed-precondition', 'Este artista tiene que volver a conectar su Mercado Pago. Probá más adelante.');
    }
    throw new HttpsError('internal', 'No pudimos iniciar el pago. Probá de nuevo en un rato.');
  }
});

// ---------------------------------------------------------------------------
// 4) Mercado Pago avisa cuando cambia un pago.
//    No confiamos en lo que llega: siempre volvemos a consultar el pago a MP.
// ---------------------------------------------------------------------------

exports.mpWebhook = onRequest({ secrets: [MP_CLIENT_SECRET, SMTP_PASS] }, async (req, res) => {
  const ordenId = String(req.query.orden ?? '');
  const tipo = req.query.type || req.query.topic || req.body?.type;
  const pagoId = String(req.query['data.id'] || req.body?.data?.id || (tipo === 'payment' ? req.query.id : '') || '');

  // Avisos que no son de pagos (ej. merchant_order) o con datos raros se ignoran
  if (tipo !== 'payment' || !/^[A-Za-z0-9]{20}$/.test(ordenId) || !/^\d{1,20}$/.test(pagoId)) {
    return res.status(200).send('ignorado');
  }

  try {
    const ordenRef = db.doc(`orders/${ordenId}`);
    const ordenSnap = await ordenRef.get();
    if (!ordenSnap.exists) return res.status(200).send('orden inexistente');
    const orden = ordenSnap.data();

    const token = await tokenDelArtista(orden.artistId);
    if (!token) {
      // Sin acceso a la cuenta del artista no se puede verificar el pago: queda para revisar a mano
      await ordenRef.update({ revisionManual: true, pagoIdAviso: pagoId });
      logger.error('REVISAR A MANO: aviso de pago sin token del artista', { ordenId, pagoId, artistId: orden.artistId });
      await enviarMail(limpiar(SMTP_USER.value()), `Revisar pedido ${ordenId} — Anverso`, plantillaMail(
        'Hay un pago para revisar a mano',
        [`Llegó un aviso del pago <strong>${escapar(pagoId)}</strong> del pedido <strong>${escapar(ordenId)}</strong>, pero el artista ya no tiene Mercado Pago conectado.`,
         'Revisá el pedido en la consola de Firebase (colección orders) y el pago en Mercado Pago.']
      ));
      return res.status(200).send('revision manual');
    }

    const pago = await mpFetch(`/v1/payments/${pagoId}`, { token });
    if (pago.external_reference !== ordenId) {
      logger.warn('El pago no corresponde a esta orden', { ordenId, pagoId });
      return res.status(200).send('no corresponde');
    }

    if (pago.status === 'approved') {
      await confirmarVenta(ordenRef, pago, token);
    } else if (['rejected', 'cancelled'].includes(pago.status)) {
      await registrarRechazo(ordenRef, pago);
    } else if (['refunded', 'charged_back'].includes(pago.status)) {
      await registrarDevolucion(ordenRef, pago);
    } else {
      // pending / in_process: solo se anota si el pedido sigue esperando el pago
      await db.runTransaction(async (tx) => {
        const o = (await tx.get(ordenRef)).data();
        if (o.estado === 'pendiente') tx.update(ordenRef, { pagoId: String(pago.id), pagoEstado: pago.status });
      });
    }
    return res.status(200).send('ok');
  } catch (e) {
    logger.error('Error procesando aviso de Mercado Pago', { ordenId, pagoId, ...resumenMp(e) });
    // 500 hace que Mercado Pago reintente más tarde
    return res.status(500).send('error');
  }
});

// Un pago rechazado solo cambia un pedido que todavía no se pagó. Si el comprador
// reintentó y pagó con otra tarjeta, un aviso tardío del intento fallido no pisa la venta.
async function registrarRechazo(ordenRef, pago) {
  await db.runTransaction(async (tx) => {
    const orden = (await tx.get(ordenRef)).data();
    if (!['pendiente', 'rechazado', 'error'].includes(orden.estado)) {
      logger.info('Aviso de rechazo ignorado: el pedido ya avanzó', { orden: ordenRef.id, estado: orden.estado, pago: pago.id });
      return;
    }
    tx.update(ordenRef, { estado: 'rechazado', pagoId: String(pago.id), pagoEstado: pago.status });
  });
}

// Devolución o contracargo del pago que confirmó la venta: el pedido queda devuelto
// y las obras vuelven al artista como pausadas, para que decida si las publica de nuevo.
async function registrarDevolucion(ordenRef, pago) {
  let devueltaAhora = false;
  await db.runTransaction(async (tx) => {
    const orden = (await tx.get(ordenRef)).data();
    if (orden.estado === 'reembolsado') return;
    if (orden.estado === 'conflicto') {
      if (orden.pagoId === String(pago.id)) {
        tx.update(ordenRef, { estado: 'reembolsado', reembolsoId: orden.reembolsoId ?? 'mp', pagoEstado: pago.status });
      }
      return;
    }
    if (orden.estado !== 'pagado' || orden.pagoId !== String(pago.id)) {
      logger.info('Aviso de devolución ignorado: no es el pago de la venta', { orden: ordenRef.id, pago: pago.id });
      return;
    }
    const obraRefs = orden.obraIds.map(id => db.doc(`artworks/${id}`));
    const obras = await Promise.all(obraRefs.map(r => tx.get(r)));
    obras.forEach((o, i) => {
      if (o.exists && o.data().estado === 'vendida' && o.data().ordenId === ordenRef.id) {
        tx.update(obraRefs[i], { estado: 'pausada' });
      }
    });
    tx.update(ordenRef, { estado: 'reembolsado', pagoEstado: pago.status, devueltoEn: FieldValue.serverTimestamp() });
    devueltaAhora = true;
  });

  if (devueltaAhora) {
    const orden = (await ordenRef.get()).data();
    logger.warn('Venta devuelta: obras pausadas', { orden: ordenRef.id, pago: pago.id, motivo: pago.status });
    await enviarMail(await emailDe(orden.artistId), 'Se devolvió una venta — Anverso', plantillaMail(
      'Se devolvió el pago de una venta',
      [`Mercado Pago devolvió el pago de ${listaObras(orden)}.`,
       'La obra volvió a tus obras como pausada. Cuando la tengas de nuevo, podés volver a publicarla desde "Mis obras".'],
      { texto: 'Ir a mis obras', url: `${WEB_URL.value()}/admin/obras` }
    ));
  }
}

// Contacto del artista para el comprador: se agrega recién con el pago aprobado
async function contactoDelArtista(artistId) {
  const ficha = (await db.doc(`users/${artistId}`).get()).data() ?? {};
  return {
    email: await emailDe(artistId),
    telefono: typeof ficha.telefono === 'string' ? ficha.telefono : null
  };
}

const MOTIVOS_DEVOLUCION = {
  vendida: (orden) => [`Mientras pagabas, otra persona compró ${listaObras(orden)}. Mercado Pago ya te está devolviendo el dinero completo.`,
    'Perdón por las molestias. Hay muchas obras más esperándote en la galería.'],
  'no-disponible': (orden) => [`${listaObras(orden)} dejó de estar a la venta mientras pagabas, así que te devolvimos el pago completo.`,
    'Hay muchas obras más esperándote en la galería.'],
  duplicado: (orden) => [`Recibimos dos pagos por ${listaObras(orden)}. Tu compra sigue en pie y te devolvimos el pago repetido completo.`,
    'No tenés que hacer nada: Mercado Pago ya te está devolviendo el dinero.'],
  precio: (orden) => [`El artista cambió el precio de ${listaObras(orden)} mientras pagabas, así que te devolvimos el pago completo.`,
    'Si todavía te interesa, podés volver a comprarla con el precio actual.'],
  monto: (orden) => [`El monto que se cobró no coincidía con el de tu pedido de ${listaObras(orden)}, así que te devolvimos el pago completo.`,
    'Podés volver a intentarlo desde tu carrito.']
};

// Marca las obras como vendidas. Si alguna ya se había vendido (dos compradores pagando
// a la vez), si cambió el precio o si el monto no coincide, se devuelve la plata sola.
async function confirmarVenta(ordenRef, pago, token) {
  let devolver = null; // motivo de la devolución, si hay que hacerla
  let pagadoAhora = false;

  const ordenPrevia = (await ordenRef.get()).data();
  const contacto = await contactoDelArtista(ordenPrevia.artistId);

  await db.runTransaction(async (tx) => {
    devolver = null;
    pagadoAhora = false;
    const orden = (await tx.get(ordenRef)).data();
    const mismoPago = orden.pagoId === String(pago.id);

    if (['pagado', 'reembolsado', 'conflicto'].includes(orden.estado)) {
      if (!mismoPago) {
        // Otro pago aprobado para un pedido ya resuelto (dos pestañas, un reintento):
        // se devuelve ese pago y el pedido no se toca
        devolver = 'duplicado';
      } else if (orden.estado === 'conflicto' && !orden.reembolsoId) {
        // Una devolución anterior falló: se reintenta (la clave de idempotencia evita devolver dos veces)
        devolver = orden.motivoConflicto ?? 'vendida';
      }
      return;
    }

    const montoOk = Math.abs(Number(pago.transaction_amount) - orden.total) < 0.01 && pago.currency_id === 'ARS';
    const obraRefs = orden.obraIds.map(id => db.doc(`artworks/${id}`));
    const obras = await Promise.all(obraRefs.map(r => tx.get(r)));
    const todasLibres = obras.every(s => s.exists && s.data().estado === 'publicada');
    const algunaVendida = obras.some(s => s.exists && s.data().estado === 'vendida');
    const mismoPrecio = obras.every((s, i) => {
      const item = orden.items[i] ?? {};
      const envioActual = Number.isInteger(s.data()?.envio) ? s.data().envio : null;
      // Pedidos viejos sin el envío anotado: solo se compara el precio
      const envioIgual = !('envio' in item) || envioActual === item.envio;
      return s.exists && s.data().precio === item.precio && envioIgual;
    });

    const motivo = !montoOk ? 'monto'
      : !todasLibres ? (algunaVendida ? 'vendida' : 'no-disponible')
      : !mismoPrecio ? 'precio' : null;
    if (motivo) {
      devolver = motivo;
      tx.update(ordenRef, { estado: 'conflicto', motivoConflicto: motivo, pagoId: String(pago.id), pagoEstado: pago.status });
      return;
    }

    for (const ref of obraRefs) {
      tx.update(ref, { estado: 'vendida', vendidaEn: FieldValue.serverTimestamp(), ordenId: ordenRef.id });
    }
    tx.update(ordenRef, {
      estado: 'pagado',
      envioEstado: 'preparando',
      pagoId: String(pago.id),
      pagoEstado: pago.status,
      pagadoEn: FieldValue.serverTimestamp(),
      artistaContacto: contacto
    });
    pagadoAhora = true;
  });

  if (pagadoAhora) await avisarVenta(ordenRef);
  if (devolver) await devolverPago(ordenRef, pago, token, devolver);
}

// Si la devolución falla, se tira el error: el aviso responde 500, Mercado Pago lo
// reintenta y confirmarVenta vuelve a probar la devolución.
async function devolverPago(ordenRef, pago, token, motivo) {
  const duplicado = motivo === 'duplicado';
  let reembolso;
  try {
    reembolso = await mpFetch(`/v1/payments/${pago.id}/refunds`, {
      token,
      method: 'POST',
      body: {},
      headers: { 'X-Idempotency-Key': `reembolso-${pago.id}` }
    });
  } catch (e) {
    logger.error('No se pudo devolver el pago: se reintenta con el próximo aviso', { orden: ordenRef.id, pago: pago.id, ...resumenMp(e) });
    throw e;
  }
  const reembolsoId = String(reembolso?.id ?? 'ok');
  await db.runTransaction(async (tx) => {
    const o = (await tx.get(ordenRef)).data();
    if (duplicado) {
      // El pedido sigue como estaba; solo se anota el pago repetido que se devolvió
      tx.update(ordenRef, { reembolsosDuplicados: FieldValue.arrayUnion(String(pago.id)) });
    } else if (o.estado === 'conflicto' && o.pagoId === String(pago.id)) {
      tx.update(ordenRef, { estado: 'reembolsado', reembolsoId });
    }
  });
  logger.warn('Pago devuelto automáticamente', { orden: ordenRef.id, pago: pago.id, motivo });
  const orden = (await ordenRef.get()).data();
  await enviarMail(orden.buyerEmail, 'Te devolvimos el pago — Anverso', plantillaMail(
    motivo === 'vendida' ? 'La obra ya se había vendido' : 'Te devolvimos el pago',
    (MOTIVOS_DEVOLUCION[motivo] ?? MOTIVOS_DEVOLUCION.vendida)(orden),
    { texto: 'Ver la galería', url: WEB_URL.value() }
  ));
}

// Mails cuando se confirma un pago: al comprador y al artista
async function avisarVenta(ordenRef) {
  const orden = (await ordenRef.get()).data();
  const web = WEB_URL.value();
  const envio = orden.envio;

  await enviarMail(orden.buyerEmail, '¡Gracias por tu compra! — Anverso', plantillaMail(
    'Tu compra está confirmada',
    [`Mercado Pago aprobó tu pago de <strong>${PESOS.format(orden.total)}</strong> por ${listaObras(orden)}, de ${escapar(orden.artistaNombre)}.`,
     'El artista ya está preparando tu obra. Te vamos a avisar por mail cuando la despache, con el código para seguir el envío.'],
    { texto: 'Ver mi pedido', url: `${web}/mis-pedidos` }
  ));

  const direccion = envio
    ? `Enviala a <strong>${escapar(envio.nombre)}</strong>, ${escapar(envio.direccion)}, ${escapar(envio.ciudad)}, ${escapar(envio.provincia)} (${escapar(envio.codigoPostal)}). Teléfono: ${escapar(envio.telefono)}.`
    : 'Escribile al comprador para coordinar la entrega.';
  await enviarMail(await emailDe(orden.artistId), '¡Vendiste una obra! — Anverso', plantillaMail(
    '¡Vendiste una obra!',
    [`Te compraron ${listaObras(orden)} por <strong>${PESOS.format(orden.total)}</strong>. La plata ya está en tu Mercado Pago.`,
     direccion,
     'Cuando la despaches, cargá el código de seguimiento en "Mis ventas" así el comprador puede seguirla.'],
    { texto: 'Ir a mis ventas', url: `${web}/admin/pagos` }
  ));
}

// ---------------------------------------------------------------------------
// 5) Seguimiento del envío. El artista marca "enviado" (con empresa y código)
//    o "entregado"; el comprador puede confirmar que la recibió.
// ---------------------------------------------------------------------------

const EMPRESAS = {
  andreani: { nombre: 'Andreani', url: 'https://www.andreani.com/?tab=seguir-envio' },
  correo: { nombre: 'Correo Argentino', url: 'https://www.correoargentino.com.ar/formularios/e-commerce' },
  oca: { nombre: 'OCA', url: 'https://www.oca.com.ar/Busquedas/Envios' },
  otra: { nombre: 'Otra empresa', url: null },
  mano: { nombre: 'Entrega en mano', url: null }
};

exports.actualizarEnvio = onCall({ secrets: [SMTP_PASS] }, async (request) => {
  const { uid } = exigirLogin(request);
  const { ordenId, estado } = request.data ?? {};
  if (typeof ordenId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ordenId) || !['enviado', 'entregado'].includes(estado)) {
    throw new HttpsError('invalid-argument', 'Datos inválidos.');
  }

  const ordenRef = db.doc(`orders/${ordenId}`);
  const snap = await ordenRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No encontramos el pedido.');
  const orden = snap.data();
  const esArtista = orden.artistId === uid;
  const esComprador = orden.buyerId === uid;

  if (!esArtista && !esComprador) throw new HttpsError('permission-denied', 'Este pedido no es tuyo.');
  if (orden.estado !== 'pagado') throw new HttpsError('failed-precondition', 'El pedido todavía no está pagado.');
  if (estado === 'enviado' && !esArtista) throw new HttpsError('permission-denied', 'Solo el artista marca el envío.');
  if (orden.envioEstado === 'entregado') throw new HttpsError('failed-precondition', 'Este pedido ya figura como entregado.');

  const web = WEB_URL.value();

  if (estado === 'enviado') {
    const empresa = request.data.empresa;
    const codigo = typeof request.data.codigo === 'string' ? request.data.codigo.trim().slice(0, 60) : '';
    if (!EMPRESAS[empresa]) throw new HttpsError('invalid-argument', 'Elegí con qué empresa lo mandaste.');
    if (empresa !== 'mano' && codigo.length < 4) {
      throw new HttpsError('invalid-argument', 'Poné el código de seguimiento que te dio la empresa.');
    }

    await ordenRef.update({
      envioEstado: 'enviado',
      seguimiento: { empresa, codigo: empresa === 'mano' ? '' : codigo },
      enviadoEn: FieldValue.serverTimestamp()
    });

    const e = EMPRESAS[empresa];
    const parrafos = empresa === 'mano'
      ? [`${escapar(orden.artistaNombre)} marcó ${listaObras(orden)} como lista para entregarte en mano. Se va a contactar con vos para coordinar.`]
      : [`${escapar(orden.artistaNombre)} despachó ${listaObras(orden)} por <strong>${escapar(e.nombre)}</strong>.`,
         `Código de seguimiento: <strong>${escapar(codigo)}</strong>`,
         e.url ? `Podés seguirla en la página de ${escapar(e.nombre)} con ese código.` : ''];
    await enviarMail(orden.buyerEmail, 'Tu obra está en camino — Anverso', plantillaMail(
      '¡Tu obra está en camino!', parrafos.filter(Boolean), { texto: 'Ver mi pedido', url: `${web}/mis-pedidos` }
    ));
    return { ok: true };
  }

  // entregado
  await ordenRef.update({
    envioEstado: 'entregado',
    entregadoEn: FieldValue.serverTimestamp(),
    entregaConfirmadaPor: esComprador ? 'comprador' : 'artista'
  });

  if (esComprador) {
    await enviarMail(await emailDe(orden.artistId), 'Tu obra llegó a destino — Anverso', plantillaMail(
      'Tu obra llegó a destino',
      [`${escapar(orden.envio?.nombre ?? orden.buyerNombre ?? 'El comprador')} confirmó que recibió ${listaObras(orden)}. ¡Venta completa!`],
      { texto: 'Ir a mis ventas', url: `${web}/admin/pagos` }
    ));
  } else {
    await enviarMail(orden.buyerEmail, 'Tu obra fue entregada — Anverso', plantillaMail(
      'Tu obra fue entregada',
      [`${escapar(orden.artistaNombre)} marcó ${listaObras(orden)} como entregada. ¡Que la disfrutes!`,
       'Si todavía no te llegó, respondé este mail o escribile al artista desde tu pedido.'],
      { texto: 'Ver mi pedido', url: `${web}/mis-pedidos` }
    ));
  }
  return { ok: true };
});
