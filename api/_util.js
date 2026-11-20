/* Utilidades de las funciones /api (Vercel, Node 18+). */
const ENV = process.env;
const PAYPAL_BASE = (ENV.PAYPAL_ENV || 'sandbox') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function leerJSON(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const partes = []; let tam = 0;
  for await (const c of req) { tam += c.length; if (tam > 100000) throw new Error('Solicitud demasiado grande.'); partes.push(c); }
  try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); } catch (e) { throw new Error('Solicitud inválida.'); }
}
function enviar(res, codigo, datos) {
  res.statusCode = codigo; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(datos));
}
/* Límite simple por IP (en memoria; cada instancia de Vercel lleva su propia cuenta). */
const visitas = new Map();
function limitar(req, max, ventanaMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  const ahora = Date.now(), lista = (visitas.get(ip) || []).filter(t => ahora - t < ventanaMs);
  lista.push(ahora); visitas.set(ip, lista);
  return lista.length <= max;
}
async function tokenPayPal() {
  if (!ENV.PAYPAL_CLIENT_ID || !ENV.PAYPAL_CLIENT_SECRET) throw new Error('PayPal no está configurado en el servidor.');
  const r = await fetch(PAYPAL_BASE + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(ENV.PAYPAL_CLIENT_ID + ':' + ENV.PAYPAL_CLIENT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!r.ok) throw new Error('No se pudo conectar con PayPal (' + r.status + ').');
  return (await r.json()).access_token;
}
async function paypal(ruta, opciones = {}) {
  const token = await tokenPayPal();
  const r = await fetch(PAYPAL_BASE + ruta, { ...opciones, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opciones.headers || {}) } });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(datos.message || ('PayPal respondió ' + r.status)); e.paypal = datos; throw e; }
  return datos;
}
module.exports = { ENV, leerJSON, enviar, limitar, paypal };
