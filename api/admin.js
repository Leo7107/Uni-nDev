/* /api/admin?a=<acción> · panel de administrador (una sola función de Vercel).
   Acceso: inicio de sesión con Supabase Auth y correo incluido en ADMIN_EMAILS (separados por comas).
   Todas las lecturas y escrituras usan la clave secreta del servidor; el navegador solo recibe un token de sesión. */
const { leerJSON, enviar, limitar } = require('./_util');
const db = require('./_db');
const UD = require('../lib/datos.js');

const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const COD = /^[A-Z]{3}-\d{3}$/;
const enc = encodeURIComponent;

function mensajeError(e) {
  const mm = String((e && e.message) || '');
  if (mm.includes('CODIGO_EXISTE')) return 'Ya existe un producto con ese código.';
  if (mm.includes('CODIGO_INVALIDO')) return 'El código debe tener 3 letras, un guion y 3 números, por ejemplo LAP-007.';
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
  /* ---------- productos ---------- */
  async productos() { return db.leer('/productos?select=*&order=orden.asc,cod.asc'); },
  async producto_guardar(q, b) {
    const p = validarProducto(b);
    if (b.nuevo) {
      const ex = parseInt(b.existencia, 10) || 0, costo = Number(b.costo_unitario) || 0;
      if (ex < 0 || ex > 100000 || costo < 0 || costo > 100000) throw new Error('Revisa la existencia y el costo inicial.');
      return db.rpc('crear_producto', { p: { cod: String(b.cod || '').toUpperCase().trim(), existencia: ex, costo_unitario: costo, ...p } });
    }
    if (!COD.test(b.cod || '')) throw new Error('Código inválido.');
    const r = await db.actualizar('/productos?cod=eq.' + enc(b.cod), { ...p, precio_sin_iva: Math.round(p.precio / 1.13 * 100) / 100, actualizado: new Date().toISOString() });
    if (!r || !r.length) throw new Error('Ese producto no existe.');
    return { cod: b.cod };
  },
  async subir(q, b) {
    const tipos = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
    if (!tipos[b.tipo]) throw new Error('La foto debe ser WEBP, JPG o PNG.');
    const buf = Buffer.from(String(b.datos || ''), 'base64');
    if (!buf.length || buf.length > 3.5 * 1024 * 1024) throw new Error('La foto pesa demasiado (máximo 3.5 MB).');
    const carpeta = /^[A-Z]{3}-\d{3}$/.test(b.cod || '') ? b.cod : 'nuevos';
    const ruta = carpeta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + tipos[b.tipo];
    return { url: await db.subirFoto(ruta, buf, b.tipo) };
  },
  async libro(q) {
    const mes = /^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : new Date().toISOString().slice(0, 7);
    const [y, m] = mes.split('-').map(Number); const fin = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    return db.leer(`/libro_ventas_cf?select=*&dia=gte.${mes}-01&dia=lt.${fin}&order=dia.asc`);
  }
};
const ESCRITURA = new Set(['compra', 'ajuste', 'anular', 'producto_guardar', 'subir']);

/* Valida y limpia la ficha de un producto que llega del panel. Lanza Error con un mensaje claro. */
const CATEGORIAS = UD.CATS.map(c => c[0]);
function texto(v, max, nombre, min) {
  const t = String(v == null ? '' : v).trim();
  if (min && t.length < min) throw new Error(`Escribe ${nombre}.`);
  if (t.length > max) throw new Error(`${nombre[0].toUpperCase() + nombre.slice(1)} es demasiado largo (máximo ${max} caracteres).`);
  return t;
}
function urlFotoValida(u) { return typeof u === 'string' && (/^\/img\/[A-Za-z0-9/_.-]+\.(webp|jpe?g|png)$/.test(u) || u.startsWith(db.urlFotos())); }
function validarProducto(b) {
  const precio = Math.round(Number(b.precio) * 100) / 100;
  if (!(precio > 0 && precio <= 100000)) throw new Error('El precio debe ser mayor que cero.');
  if (!CATEGORIAS.includes(b.categoria)) throw new Error('Elige una categoría de la lista.');
  const lista = (v, max) => { if (!Array.isArray(v) || v.length > max) throw new Error('Hay demasiados elementos en la ficha.'); return v; };
  const puntos = lista(b.puntos || [], 6).map(x => [texto(x[0], 80, 'el título del punto destacado', 1), texto(x[1], 300, 'el texto del punto destacado')]).filter(x => x[0]);
  const especificaciones = lista(b.especificaciones || [], 30).map(x => [texto(x[0], 60, 'el nombre de la especificación', 1), texto(x[1], 200, 'el valor de la especificación', 1)]);
  const galeria = lista(b.galeria || [], 12);
  if (!galeria.every(urlFotoValida)) throw new Error('Una de las fotos no es válida. Vuelve a subirla.');
  const versiones = lista(b.versiones || [], 4).map(g => {
    const ops = lista(g.ops || [], 8);
    if (ops.length < 2) throw new Error('Cada grupo de versiones necesita al menos 2 opciones.');
    return {
      t: texto(g.t, 40, 'el nombre del grupo de versiones', 1), color: !!g.color,
      ops: ops.map((o, i) => {
        const d = i === 0 ? 0 : Math.round(Number(o[1] || 0) * 100) / 100;
        if (!(Math.abs(d) <= 10000)) throw new Error('Revisa la diferencia de precio de las versiones.');
        const hex = g.color ? String(o[2] || '#cccccc') : null;
        if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error('Color inválido en las versiones.');
        const fotos = Array.isArray(o[3]) && o[3].length ? o[3].filter(urlFotoValida).slice(0, 8) : null;
        const ir = o[4] && COD.test(o[4]) ? o[4] : null;
        return [texto(o[0], 60, 'el nombre de la opción', 1), ir ? null : d, hex, fotos, ir];
      })
    };
  });
  return {
    nombre: texto(b.nombre, 120, 'el nombre', 3), categoria: b.categoria, marca: texto(b.marca, 60, 'la marca', 1),
    specs_corto: texto(b.specs_corto, 160, 'la línea corta'), resumen: texto(b.resumen, 240, 'el resumen'),
    descripcion_larga: texto(b.descripcion_larga, 3000, 'la descripción'), puntos, especificaciones, galeria, versiones,
    activo: b.activo !== false, precio
  };
}

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
    const b = req.method === 'POST' ? await leerJSON(req, a === 'subir' ? 5000000 : 300000) : {};
    enviar(res, 200, { datos: await accion(q, b) });
  } catch (e) {
    const m = mensajeError(e);
    if (!m) console.error('admin', a, e.message);
    enviar(res, m ? 400 : 500, { error: m || e.message || 'No se pudo completar la acción.' });
  }
};
