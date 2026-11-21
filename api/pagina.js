/* /producto/:cod y /sitemap.xml (vía rewrites de vercel.json): páginas generadas con el catálogo vigente,
   así un producto nuevo del panel aparece de inmediato con sus etiquetas para Google. */
const fs = require('fs'), path = require('path');
const cat = require('./_catalogo');
const seo = require('../lib/seo.js');

let plantilla = null;
function leerPlantilla() {
  if (!plantilla) plantilla = fs.readFileSync(path.join(__dirname, '..', 'plantilla.html'), 'utf8');
  return plantilla;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const site = seo.sitio();
  try {
    const C = await cat.obtener();
    if (url.searchParams.get('tipo') === 'sitemap') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('CDN-Cache-Control', 'public, s-maxage=300');
      return res.end(seo.sitemap(C, site));
    }
    const cod = String(url.searchParams.get('cod') || '').toUpperCase();
    const p = /^[A-Z]{3}-\d{3}$/.test(cod) && C.by(cod);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!p || p.activo === false) { res.statusCode = 404; return res.end(seo.inicio(leerPlantilla(), C, site).replace('<title>UniónDev · Computadoras y accesorios en San Salvador</title>', '<title>Producto no encontrado · UniónDev</title><meta name="robots" content="noindex">')); }
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(seo.producto(leerPlantilla(), C, p, site));
  } catch (e) {
    console.error('pagina', e.message);
    res.statusCode = 500; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('No se pudo cargar la página. Inténtalo de nuevo en unos segundos.');
  }
};
