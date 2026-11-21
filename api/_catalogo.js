/* Catálogo vigente para el servidor: desde Supabase si está configurado (con caché corta), si no, el del archivo. */
const db = require('./_db');
const UD = require('../lib/datos.js');

const CAMPOS = 'cod,categoria,descripcion,marca,existencia,precio_sin_iva,precio,nombre,specs_corto,resumen,descripcion_larga,puntos,especificaciones,galeria,versiones,activo,orden';
let cache = null, cacheHasta = 0;

async function filas() {
  return db.leer('/productos?select=' + CAMPOS + '&order=orden.asc,cod.asc');
}

/* Devuelve el catálogo con sus ayudantes (by, precioDe, …). `fresco` evita la caché (para cobrar y facturar). */
async function obtener(fresco) {
  if (!db.configurada()) return UD;
  if (!fresco && cache && Date.now() < cacheHasta) return cache;
  cache = UD.desdeFilas(await filas());
  cacheHasta = Date.now() + 15000;
  return cache;
}

module.exports = { obtener, filas, CAMPOS };
