/* GET /api/catalogo → productos visibles en la tienda con su ficha, fotos, versiones y existencias (sin costos). */
const { enviar } = require('./_util');
const db = require('./_db');
const cat = require('./_catalogo');

module.exports = async (req, res) => {
  if (!db.configurada()) return enviar(res, 200, { fuente: 'catalogo', productos: null });
  try {
    const [todos, promociones] = await Promise.all([cat.filas(), cat.promociones()]);
    const productos = todos.filter(f => f.activo !== false);
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ fuente: 'supabase', productos, promociones }));
  } catch (e) {
    console.error('catalogo', e.message);
    enviar(res, 503, { error: 'No se pudo leer el catálogo en este momento.' });
  }
};
