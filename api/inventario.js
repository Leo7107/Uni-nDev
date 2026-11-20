/* GET /api/inventario → existencias actuales { 'LAP-001': 3, ... }.
   Con Supabase lee la tabla productos; sin base de datos devuelve las del catálogo (Excel). */
const { enviar } = require('./_util');
const db = require('./_db');
const UD = require('../lib/datos.js');

module.exports = async (req, res) => {
  try {
    const datos = db.configurada() ? await db.existencias() : Object.fromEntries(UD.P.map(p => [p.cod, p.stock]));
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ existencias: datos, fuente: db.configurada() ? 'supabase' : 'catalogo' }));
  } catch (e) {
    console.error('inventario', e.message);
    enviar(res, 503, { error: 'No se pudo leer el inventario en este momento.' });
  }
};
