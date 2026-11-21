/* Conexión con Supabase a través de su API REST (PostgREST), solo desde el servidor.
   Variables: SUPABASE_URL y SUPABASE_SECRET_KEY (clave secreta o service_role; nunca la pongas en el navegador). */
const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CLAVE = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function configurada() { return Boolean(URL_BASE && CLAVE); }

function cabeceras(extra) {
  const h = { apikey: CLAVE, 'Content-Type': 'application/json', ...(extra || {}) };
  if (CLAVE.startsWith('eyJ')) h.Authorization = 'Bearer ' + CLAVE; /* claves service_role antiguas (JWT) */
  return h;
}

async function pedir(ruta, opciones) {
  const r = await fetch(URL_BASE + '/rest/v1' + ruta, { ...opciones, headers: cabeceras(opciones && opciones.headers) });
  const texto = await r.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!r.ok) { const e = new Error((datos && datos.message) || ('Supabase respondió ' + r.status)); e.status = r.status; e.datos = datos; throw e; }
  return datos;
}

/* Emite la factura y descuenta inventario en un solo paso (función emitir_factura en esquema.sql). */
function emitirFactura(f) { return pedir('/rpc/emitir_factura', { method: 'POST', body: JSON.stringify({ p: f }) }); }

/* { 'LAP-001': 3, ... } */
async function existencias() {
  const filas = await pedir('/rpc/existencias', { method: 'POST', body: '{}' });
  const o = {}; for (const f of filas) o[f.cod] = f.existencia; return o;
}

function marcarCorreoEnviado(id) {
  return pedir('/facturas?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ correo_enviado: true }) });
}

/* Traduce 'SIN_EXISTENCIA:LAP-002:0' en un mensaje para el cliente. */
function errorExistencia(e, nombrePorCod) {
  const m = /SIN_EXISTENCIA:([A-Z]{3}-\d{3}):(\d+)/.exec((e && e.message) || '');
  if (!m) return null;
  const n = +m[2], nombre = nombrePorCod(m[1]) || m[1];
  return { cod: m[1], disponible: n, mensaje: n === 0 ? `Se acaba de vender la última unidad de ${nombre}. Quítalo del carrito o elige la versión por encargo.` : `Solo quedan ${n} unidades de ${nombre}. Ajusta la cantidad en tu carrito.` };
}

/* Genéricos para el panel: lectura por la API REST y llamada a funciones. */
function leer(ruta) { return pedir(ruta, { method: 'GET' }); }
function rpc(nombre, args) { return pedir('/rpc/' + nombre, { method: 'POST', body: JSON.stringify(args || {}) }); }

/* Supabase Auth: inicio de sesión con correo y contraseña, y verificación del token del administrador. */
async function auth(ruta, opciones) {
  const r = await fetch(URL_BASE + '/auth/v1' + ruta, { ...opciones, headers: { apikey: CLAVE, 'Content-Type': 'application/json', ...((opciones && opciones.headers) || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.msg || d.error_description || d.message || ('Auth respondió ' + r.status)); e.status = r.status; throw e; }
  return d;
}
function iniciarSesion(correo, clave) { return auth('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: correo, password: clave }) }); }
function usuarioDelToken(token) { return auth('/user', { method: 'GET', headers: { Authorization: 'Bearer ' + token } }); }

function insertar(ruta, datos) { return pedir(ruta, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(datos) }); }
function actualizar(ruta, datos) { return pedir(ruta, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(datos) }); }

/* Supabase Storage: sube una foto al bucket público "productos" y devuelve su URL pública. */
async function subirFoto(ruta, buffer, tipo) {
  const h = { apikey: CLAVE, 'Content-Type': tipo, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' };
  if (CLAVE.startsWith('eyJ')) h.Authorization = 'Bearer ' + CLAVE;
  const r = await fetch(URL_BASE + '/storage/v1/object/productos/' + ruta, { method: 'POST', headers: h, body: buffer });
  if (!r.ok) { const t = await r.text(); const e = new Error('No se pudo guardar la foto (' + r.status + '): ' + t.slice(0, 160)); e.status = r.status; throw e; }
  return URL_BASE + '/storage/v1/object/public/productos/' + ruta;
}
function urlFotos() { return URL_BASE + '/storage/v1/object/public/productos/'; }

module.exports = { configurada, emitirFactura, existencias, marcarCorreoEnviado, errorExistencia, leer, rpc, iniciarSesion, usuarioDelToken, insertar, actualizar, subirFoto, urlFotos };
