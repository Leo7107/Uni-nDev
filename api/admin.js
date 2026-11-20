/* /api/admin?a=<acción> · panel de administrador (una sola función de Vercel).
   Acceso: inicio de sesión con Supabase Auth y correo incluido en ADMIN_EMAILS (separados por comas).
   Todas las lecturas y escrituras usan la clave secreta del servidor; el navegador solo recibe un token de sesión. */
const { leerJSON, enviar, limitar } = require('./_util');
const db = require('./_db');

const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const COD = /^[A-Z]{3}-\d{3}$/;
const enc = encodeURIComponent;

function mensajeError(e) {
  const m = String((e && e.message) || '');
  if (/SIN_EXISTENCIA:([A-Z]{3}-\d{3}):(\d+)/.test(m)) { const [, c, n] = m.match(/SIN_EXISTENCIA:([A-Z]{3}-\d{3}):(\d+)/); return `El ajuste dejaría ${c} en negativo: solo hay ${n} unidades.`; }
  if (m.includes('PRODUCTO_NO_EXISTE')) return 'Ese producto no existe.';
  if (m.includes('CANTIDAD_INVALIDA')) return 'La cantidad debe ser un número entero distinto de cero.';
  if (m.includes('COSTO_INVALIDO')) return 'El costo unitario debe ser un número mayor o igual a cero.';
  if (m.includes('FALTA_MOTIVO')) return 'Escribe el motivo.';
  if (m.includes('YA_ANULADA')) return 'Esa factura ya estaba anulada.';
  if (m.includes('FACTURA_NO_EXISTE')) return 'Esa factura no existe.';
  return null;
}

async function verificarAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try { const u = await db.usuarioDelToken(token); return u && u.email && ADMINS.includes(u.email.toLowerCase()) ? u : null; } catch (e) { return null; }
}

const ACCIONES = {
  /* Resumen: ventas por mes, inventario valorizado, últimas facturas y existencias bajas. */
  async resumen() {
    const [meses, inventario, ultimas] = await Promise.all([
      db.leer('/resumen_ventas_mensual?select=*&order=mes.desc&limit=12'),
      db.leer('/inventario_valorizado?select=cod,descripcion,existencia,valor_al_costo'),
      db.leer('/facturas?select=id,correlativo,fecha,cliente_nombre,pago,ventas_gravadas,estado&order=correlativo.desc&limit=8')
    ]);
    return {
      meses, ultimas,
      inventario: { unidades: inventario.reduce((a, p) => a + p.existencia, 0), valor: +inventario.reduce((a, p) => a + Number(p.valor_al_costo), 0).toFixed(2), productos: inventario.length },
      bajas: inventario.filter(p => p.existencia <= 1).map(p => ({ cod: p.cod, descripcion: p.descripcion, existencia: p.existencia }))
    };
  },
  async inventario() { return db.leer('/inventario_valorizado?select=*&order=cod'); },
  async kardex(q) {
    if (!COD.test(q.cod || '')) throw new Error('Código inválido.');
    return db.leer('/kardex?select=id,fecha,tipo,cantidad,costo_unitario,costo_total,existencia_resultante,referencia&cod=eq.' + enc(q.cod) + '&order=id.asc');
  },
  async compra(q, b) {
    if (!COD.test(b.cod || '')) throw new Error('Código inválido.');
    return db.rpc('registrar_compra', { p_cod: b.cod, p_cantidad: parseInt(b.cantidad, 10), p_costo: Number(b.costo), p_referencia: String(b.referencia || '').slice(0, 120) });
  },
  async ajuste(q, b) {
    if (!COD.test(b.cod || '')) throw new Error('Código inválido.');
    return db.rpc('ajustar_inventario', { p_cod: b.cod, p_cantidad: parseInt(b.cantidad, 10), p_motivo: String(b.motivo || '').slice(0, 120) });
  },
  async facturas(q) {
    const mes = /^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : null;
    let filtro = '';
    if (mes) { const [y, m] = mes.split('-').map(Number); const fin = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; filtro = `&fecha=gte.${mes}-01T00:00:00-06:00&fecha=lt.${fin}-01T00:00:00-06:00`; }
    return db.leer('/facturas?select=id,correlativo,control,fecha,cliente_nombre,cliente_correo,pago,entrega,ventas_gravadas,ventas_netas,iva_debito,costo_ventas,correo_enviado,estado&order=correlativo.desc&limit=500' + filtro);
  },
  async factura(q) {
    const id = parseInt(q.id, 10); if (!(id > 0)) throw new Error('Factura inválida.');
    const [f] = await db.leer('/facturas?select=*&id=eq.' + id);
    if (!f) throw new Error('Esa factura no existe.');
    f.detalle = await db.leer('/factura_detalle?select=*&factura_id=eq.' + id + '&order=linea.asc');
    return f;
  },
  async anular(q, b) {
    const id = parseInt(b.id, 10); if (!(id > 0)) throw new Error('Factura inválida.');
    return db.rpc('anular_factura', { p_id: id, p_motivo: String(b.motivo || '').slice(0, 160) });
  },
  async libro(q) {
    const mes = /^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : new Date().toISOString().slice(0, 7);
    const [y, m] = mes.split('-').map(Number); const fin = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return db.leer(`/libro_ventas_cf?select=*&dia=gte.${mes}-01&dia=lt.${fin}&order=dia.asc`);
  }
};
const ESCRITURA = new Set(['compra', 'ajuste', 'anular']);

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x'), a = url.searchParams.get('a') || '';
  const q = Object.fromEntries(url.searchParams);
  if (!db.configurada()) return enviar(res, 503, { error: 'La base de datos no está configurada (faltan SUPABASE_URL y SUPABASE_SECRET_KEY).' });
  if (!ADMINS.length) return enviar(res, 503, { error: 'Falta ADMIN_EMAILS: el correo del administrador en las variables del servidor.' });

  if (a === 'login') {
    if (req.method !== 'POST') return enviar(res, 405, { error: 'Método no permitido.' });
    if (!limitar(req, 8, 10 * 60 * 1000)) return enviar(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
    try {
      const b = await leerJSON(req), correo = String(b.correo || '').trim().toLowerCase();
      if (!ADMINS.includes(correo)) return enviar(res, 401, { error: 'Correo o contraseña incorrectos.' });
      const s = await db.iniciarSesion(correo, String(b.clave || ''));
      return enviar(res, 200, { token: s.access_token, expira: Date.now() + (s.expires_in || 3600) * 1000, correo });
    } catch (e) { return enviar(res, 401, { error: 'Correo o contraseña incorrectos.' }); }
  }

  const accion = ACCIONES[a];
  if (!accion) return enviar(res, 404, { error: 'Acción desconocida.' });
  if (ESCRITURA.has(a) !== (req.method === 'POST')) return enviar(res, 405, { error: 'Método no permitido.' });
  const u = await verificarAdmin(req);
  if (!u) return enviar(res, 401, { error: 'Tu sesión venció. Vuelve a iniciar sesión.' });
  try {
    const b = req.method === 'POST' ? await leerJSON(req) : {};
    enviar(res, 200, { datos: await accion(q, b) });
  } catch (e) {
    const m = mensajeError(e);
    if (!m) console.error('admin', a, e.message);
    enviar(res, m ? 400 : 500, { error: m || e.message || 'No se pudo completar la acción.' });
  }
};
