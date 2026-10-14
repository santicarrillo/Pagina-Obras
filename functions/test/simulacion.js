// Simulación de los pagos de Anverso: corre las funciones reales contra una base de datos
// y un Mercado Pago falsos, sin tocar nada real. Uso: cd functions && npm test
const Module = require('module');
const assert = require('assert');
const path = require('path');
const RUTA = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'index.js');

// ---------- Firestore en memoria ----------
let store = new Map();
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o, (k, v) => (v && v.__ts ? { __ts: v.__ts } : v))));
const SERVER_TS = { __serverTs: true };
const tsNow = () => ({ __ts: Date.now(), toMillis() { return this.__ts; } });
function revive(o) {
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (o[k] && o[k].__ts !== undefined) { const v = o[k].__ts; o[k] = { __ts: v, toMillis: () => v }; }
      else revive(o[k]);
    }
  }
  return o;
}
function applyUpdate(cur, upd) {
  const out = { ...(cur || {}) };
  for (const [k, v] of Object.entries(upd)) {
    if (v === SERVER_TS) out[k] = { __ts: Date.now() };
    else if (v && v.__arrayUnion) out[k] = [...new Set([...(out[k] || []), ...v.__arrayUnion])];
    else out[k] = v;
  }
  return out;
}
function snap(path) {
  const d = store.get(path);
  return { exists: d !== undefined, id: path.split('/').pop(), ref: docRef(path), data: () => revive(clone(d)) };
}
function docRef(path) {
  return {
    path, id: path.split('/').pop(),
    get: async () => snap(path),
    set: async (data, opt) => { store.set(path, opt?.merge ? applyUpdate(store.get(path), data) : applyUpdate({}, data)); },
    update: async (data) => { if (!store.has(path)) throw new Error('no existe ' + path); store.set(path, applyUpdate(store.get(path), data)); },
    delete: async () => { store.delete(path); }
  };
}
let autoId = 0;
function collection(name) {
  const filters = [];
  const q = {
    where(f, op, v) { filters.push([f, op, v]); return q; },
    doc() { autoId++; return docRef(`${name}/${('ORDEN' + autoId).padEnd(20, 'x')}`); },
    async get() {
      const docs = [...store.keys()].filter(k => k.startsWith(name + '/') && k.split('/').length === 2)
        .map(k => snap(k)).filter(s => filters.every(([f, op, v]) => {
          const x = s.data()[f]; return op === '==' ? x === v : op === 'in' ? v.includes(x) : false;
        }));
      return { docs, size: docs.length };
    }
  };
  return q;
}
const db = {
  doc: (p) => docRef(p),
  collection,
  batch() { const ops = []; return { update: (r, d) => ops.push(() => r.update(d)), delete: (r) => ops.push(() => r.delete()), set: (r, d) => ops.push(() => r.set(d)), commit: async () => { for (const o of ops) await o(); } }; },
  async runTransaction(fn) {
    let wrote = false; const writes = [];
    const tx = {
      get: async (r) => { if (wrote) throw new Error('LECTURA DESPUES DE ESCRITURA en transaccion'); return r.get(); },
      update: (r, d) => { wrote = true; writes.push(() => r.update(d)); },
      delete: (r) => { wrote = true; writes.push(() => r.delete()); },
      set: (r, d) => { wrote = true; writes.push(() => r.set(d)); }
    };
    const res = await fn(tx);
    for (const w of writes) await w();
    return res;
  }
};

// ---------- Mercado Pago falso ----------
let pagos = {};           // id -> pago
let refunds = [];         // ids devueltos
let refundFalla = false;
let mails = [];
let prefCreada = null;
global.fetch = async (url, opts = {}) => {
  const u = new URL(url); const body = opts.body ? JSON.parse(opts.body) : null;
  const resp = (status, obj) => ({ ok: status < 400, status, text: async () => JSON.stringify(obj) });
  let m;
  if ((m = u.pathname.match(/^\/v1\/payments\/(\d+)\/refunds$/))) {
    if (refundFalla) return resp(500, { message: 'caido' });
    if (!refunds.includes(m[1])) refunds.push(m[1]);
    return resp(201, { id: 900 + refunds.length });
  }
  if ((m = u.pathname.match(/^\/v1\/payments\/(\d+)$/))) return pagos[m[1]] ? resp(200, pagos[m[1]]) : resp(404, {});
  if (u.pathname === '/checkout/preferences') { prefCreada = body; return resp(201, { id: 'pref1', init_point: 'https://mp/pay' }); }
  if (u.pathname === '/oauth/token') return resp(400, { error: 'invalid_grant' });
  return resp(404, {});
};

// ---------- módulos falsos ----------
const handlers = {};
class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fakes = {
  'firebase-functions/v2/https': {
    onCall: (o, h) => h || o, onRequest: (o, h) => h || o, HttpsError
  },
  'firebase-functions/v2': { setGlobalOptions() {} },
  'firebase-functions/params': {
    defineSecret: (n) => ({ value: () => (n === 'SMTP_PASS' ? 'x' : 'secreto') }),
    defineString: (n, o) => ({ value: () => ({ MP_CLIENT_ID: '123', WEB_URL: 'https://web', SMTP_USER: 'anverso@gmail.com' }[n] ?? o?.default) }),
    defineInt: (n, o) => ({ value: () => 0 })
  },
  'firebase-functions/logger': { info() {}, warn() {}, error() {} },
  'firebase-admin/app': { initializeApp() {} },
  'firebase-admin/auth': { getAuth: () => ({ getUser: async (uid) => ({ email: uid + '@mail.com' }), deleteUser: async () => {} }) },
  'nodemailer': { createTransport: () => ({ sendMail: async (m) => mails.push(m) }) },
  'firebase-admin/firestore': {
    getFirestore: () => db,
    FieldValue: { serverTimestamp: () => SERVER_TS, arrayUnion: (...v) => ({ __arrayUnion: v }) },
    Timestamp: { fromMillis: (ms) => ({ __ts: ms, toMillis: () => ms }) }
  }
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return fakes[req] ?? origLoad.call(this, req, ...rest); };
const fns = require(RUTA);

// ---------- helpers ----------
function reset() {
  store = new Map(); pagos = {}; refunds = []; refundFalla = false; mails = []; autoId = 0;
  store.set('artists/art1', { nombreArtistico: 'Ana' });
  store.set('users/art1', { telefono: '11 5555' });
  store.set('mp_cuentas/art1', { accessToken: 'tok', refreshToken: 'r', expiraEn: { __ts: Date.now() + 90 * 864e5 } });
  store.set('pagos_artistas/art1', { conectado: true });
  store.set('artworks/obra1', { artistId: 'art1', artistaNombre: 'Ana', titulo: 'Mar', precio: 1000, envio: 200, estado: 'publicada', imagenUrl: 'x', tecnica: 'Óleo' });
}
const ENVIO = { nombre: 'Juan Perez', telefono: '1144445555', direccion: 'Calle 123', ciudad: 'Rosario', provincia: 'Santa Fe', codigoPostal: '2000' };
async function comprar(uid = 'comp1') {
  const r = await fns.crearPago({ auth: { uid, token: { email: uid + '@mail.com' } }, data: { obraIds: ['obra1'], envio: ENVIO } });
  return r.ordenId;
}
async function aviso(ordenId, pagoId) {
  let code; const res = { status: (c) => { code = c; return { send: () => code }; } };
  await fns.mpWebhook({ query: { orden: ordenId, type: 'payment', 'data.id': String(pagoId) }, body: {} }, res);
  return code;
}
const orden = (id) => store.get('orders/' + id);
const obra = () => store.get('artworks/obra1');
const pagoMp = (id, ordenId, status, monto = 1200) => { pagos[id] = { id: Number(id), status, external_reference: ordenId, transaction_amount: monto, currency_id: 'ARS' }; };

const casos = [];
const caso = (n, f) => casos.push([n, f]);

caso('Compra normal: queda pagado, obra vendida, contacto recien al pagar', async () => {
  const o = await comprar();
  assert.equal(orden(o).artistaContacto, null, 'contacto no debe estar antes de pagar');
  assert.ok(prefCreada.expires && /-03:00$/.test(prefCreada.expiration_date_to), 'preferencia con vencimiento');
  pagoMp('111', o, 'approved');
  assert.equal(await aviso(o, 111), 200);
  assert.equal(orden(o).estado, 'pagado'); assert.equal(obra().estado, 'vendida');
  assert.deepEqual(orden(o).artistaContacto, { email: 'art1@mail.com', telefono: '11 5555' });
  assert.equal(refunds.length, 0);
});
caso('Rechazo tardio NO pisa un pedido pagado', async () => {
  const o = await comprar();
  pagoMp('111', o, 'approved'); await aviso(o, 111);
  pagoMp('110', o, 'rejected'); await aviso(o, 110);
  assert.equal(orden(o).estado, 'pagado'); assert.equal(orden(o).pagoId, '111');
});
caso('Rechazo y despues pago aprobado: queda pagado', async () => {
  const o = await comprar();
  pagoMp('110', o, 'rejected'); await aviso(o, 110);
  assert.equal(orden(o).estado, 'rechazado');
  pagoMp('111', o, 'approved'); await aviso(o, 111);
  assert.equal(orden(o).estado, 'pagado'); assert.equal(obra().estado, 'vendida');
});
caso('Devolucion del pago de la venta: pedido devuelto y obra pausada', async () => {
  const o = await comprar();
  pagoMp('111', o, 'approved'); await aviso(o, 111);
  pagoMp('111', o, 'refunded'); await aviso(o, 111);
  assert.equal(orden(o).estado, 'reembolsado'); assert.equal(obra().estado, 'pausada');
});
caso('Devolucion de OTRO pago no toca la venta', async () => {
  const o = await comprar();
  pagoMp('111', o, 'approved'); await aviso(o, 111);
  pagoMp('222', o, 'refunded'); await aviso(o, 222);
  assert.equal(orden(o).estado, 'pagado'); assert.equal(obra().estado, 'vendida');
});
caso('Dos compradores pagan la misma obra: el segundo se devuelve', async () => {
  const a = await comprar('compA'); const b = await comprar('compB');
  pagoMp('111', a, 'approved'); await aviso(a, 111);
  pagoMp('222', b, 'approved'); await aviso(b, 222);
  assert.equal(orden(a).estado, 'pagado'); assert.equal(orden(b).estado, 'reembolsado');
  assert.deepEqual(refunds, ['222']);
  assert.ok(mails.some(m => m.to === 'compB@mail.com' && /ya se había vendido/.test(m.html)));
});
caso('Precio cambiado mientras pagaba: se devuelve', async () => {
  const o = await comprar();
  store.set('artworks/obra1', { ...obra(), precio: 5000 });
  pagoMp('111', o, 'approved'); await aviso(o, 111);
  assert.equal(orden(o).estado, 'reembolsado'); assert.equal(obra().estado, 'publicada'); assert.deepEqual(refunds, ['111']);
});
caso('Monto pagado distinto al total: se devuelve', async () => {
  const o = await comprar();
  pagoMp('111', o, 'approved', 10); await aviso(o, 111);
  assert.equal(orden(o).estado, 'reembolsado'); assert.equal(obra().estado, 'publicada');
});
caso('Obra pausada mientras pagaba: devolucion con motivo correcto', async () => {
  const o = await comprar();
  store.set('artworks/obra1', { ...obra(), estado: 'pausada' });
  pagoMp('111', o, 'approved'); await aviso(o, 111);
  assert.equal(orden(o).estado, 'reembolsado');
  assert.ok(mails.some(m => /dejó de estar a la venta/.test(m.html)));
});
caso('Devolucion que falla: 500 y se reintenta con el proximo aviso', async () => {
  const a = await comprar('compA'); const b = await comprar('compB');
  pagoMp('111', a, 'approved'); await aviso(a, 111);
  refundFalla = true;
  pagoMp('222', b, 'approved');
  assert.equal(await aviso(b, 222), 500);
  assert.equal(orden(b).estado, 'conflicto');
  refundFalla = false;
  assert.equal(await aviso(b, 222), 200);
  assert.equal(orden(b).estado, 'reembolsado'); assert.deepEqual(refunds, ['222']);
});
caso('Pago duplicado sobre pedido ya pagado: se devuelve el duplicado, la venta sigue', async () => {
  const o = await comprar();
  pagoMp('111', o, 'approved'); await aviso(o, 111);
  pagoMp('333', o, 'approved'); await aviso(o, 333);
  assert.equal(orden(o).estado, 'pagado'); assert.equal(obra().estado, 'vendida');
  assert.deepEqual(refunds, ['333']); assert.deepEqual(orden(o).reembolsosDuplicados, ['333']);
});
caso('Aviso repetido del mismo pago aprobado: no hace nada mas', async () => {
  const o = await comprar();
  pagoMp('111', o, 'approved'); await aviso(o, 111); await aviso(o, 111);
  assert.equal(orden(o).estado, 'pagado'); assert.equal(refunds.length, 0);
  assert.equal(mails.filter(m => /Gracias por tu compra/.test(m.subject)).length, 1);
});
caso('Aviso con ids raros: se ignora', async () => {
  const code = await aviso('../../users/x', '1');
  assert.equal(code, 200); 
});
caso('Mas de 5 pagos pendientes en una hora: se frena', async () => {
  for (let i = 0; i < 5; i++) await comprar();
  await assert.rejects(() => comprar(), /varios pagos/);
});
caso('Baja de artista con venta sin entregar: se frena', async () => {
  const o = await comprar();
  pagoMp('111', o, 'approved'); await aviso(o, 111);
  await assert.rejects(() => fns.dejarDeSerArtista({ auth: { uid: 'art1' } }), /sin terminar/);
  store.set('orders/' + o, { ...orden(o), envioEstado: 'entregado' });
  // queda el pedido pendiente reciente? no: ya esta pagado y entregado
  await fns.dejarDeSerArtista({ auth: { uid: 'art1' } });
  assert.equal(store.has('mp_cuentas/art1'), false);
});
caso('Aviso sin token del artista: revision manual y mail a Anverso', async () => {
  const o = await comprar();
  store.delete('mp_cuentas/art1');
  pagoMp('111', o, 'approved');
  assert.equal(await aviso(o, 111), 200);
  assert.equal(orden(o).revisionManual, true);
  assert.ok(mails.some(m => m.to === 'anverso@gmail.com'));
});
caso('Token revocado al renovar: artista desconectado y avisado', async () => {
  store.set('mp_cuentas/art1', { accessToken: 'tok', refreshToken: 'r', expiraEn: { __ts: Date.now() + 864e5 } });
  await assert.rejects(() => comprar(), /no puede recibir pagos/);
  assert.equal(store.get('pagos_artistas/art1').conectado, false);
  assert.ok(mails.some(m => /Volvé a conectar/.test(m.subject)));
});

(async () => {
  let ok = 0;
  for (const [n, f] of casos) {
    reset();
    try { await f(); ok++; console.log('OK   ', n); }
    catch (e) { console.log('FALLA', n, '\n      ', e.message); }
  }
  console.log(`\n${ok}/${casos.length} escenarios OK`);
  if (ok !== casos.length) process.exitCode = 1;
})();
