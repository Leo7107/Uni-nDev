/* Catálogo vigente para el servidor: desde Supabase si está configurado (con caché corta), si no, el del archivo. */
const db = require('./_db');
const UD = require('../lib/datos.js');

const CAMPOS = 'cod,categoria,descripcion,marca,existencia,precio_sin_iva,precio,nombre,specs_corto,resumen,descripcion_larga,puntos,especificaciones,galeria,versiones,activo,orden';
let cache = null, cacheHasta = 0;

async function filas() {
  return db.leer('/productos?select=' + CAMPOS + '&order=orden.asc,cod.asc');
}
/* Promociones activas que todavía no terminan (si la tabla no existe aún, ninguna). */
async function promociones() {
  try {
    const ahora = Date.now();
    return (await db.leer('/promociones?select=id,nombre,tipo,valor,alcance,objetivo,inicio,fin,activa&activa=eq.true')).filter(p => new Date(p.fin).getTime() > ahora);
  } catch (e) { return []; }
}

/* Devuelve el catálogo con sus ayudantes (by, precioDe, …). `fresco` evita la caché (para cobrar y facturar). */
async function obtener(fresco) {
  if (!db.configurada()) return UD;
  if (!fresco && cache && Date.now() < cacheHasta) return cache;
  try {
    const [f, pr] = await Promise.all([filas(), promociones()]);
    cache = UD.desdeFilas(f, pr);
    cacheHasta = Date.now() + 15000;
    return cache;
  } catch (e) {
    /* Si la tabla aún no tiene los campos del catálogo (falta 03-productos.sql) o Supabase no responde, usa el del archivo. */
    console.error('catálogo desde Supabase no disponible:', e.message);
    return cache || UD;
  }
}

module.exports = { obtener, filas, promociones, CAMPOS };
