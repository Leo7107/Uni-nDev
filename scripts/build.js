/* Compila el sitio para Vercel:
   1. Copia los módulos compartidos de /lib a /public/js.
   2. Genera una página HTML por producto (/producto/LAP-001) con título, descripción y datos estructurados para Google.
   3. Genera sitemap.xml y robots.txt.
   SITE_URL (variable de entorno) es la dirección pública, p. ej. https://uniondev.vercel.app */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), PUB = path.join(R, 'public');
const SITE = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'https://uniondev.vercel.app')).replace(/\/$/, '');
const UD = require(path.join(R, 'lib', 'datos.js'));

for (const f of ['datos.js', 'factura.js', 'logo.js']) fs.copyFileSync(path.join(R, 'lib', f), path.join(PUB, 'js', f));

/* La plantilla vive en /plantilla.html y no se modifica; el build escribe public/index.html y las páginas de producto. */
const plantilla = fs.readFileSync(path.join(R, 'plantilla.html'), 'utf8');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const seo = (cab, contenido) => plantilla.replace('<!--SEO:CABECERA-->', cab).replace('<!--SEO:CONTENIDO-->', contenido);

/* Página de inicio: canónica absoluta y lista de productos para buscadores sin JavaScript. */
const lista = '<noscript><h1>UniónDev · Computadoras y accesorios en San Salvador</h1><ul>' + UD.P.map(p => `<li><a href="/producto/${p.cod}">${esc(p.nombre)}</a> · $${p.precio.toFixed(2)} IVA incluido</li>`).join('') + '</ul></noscript>';
fs.writeFileSync(path.join(PUB, 'index.html'), seo(`<title>UniónDev · Computadoras y accesorios en San Salvador</title>
<meta name="description" content="Laptops, monitores, impresoras, teclados, mouse y más en San Salvador. Precios con IVA incluido, factura electrónica y entrega a domicilio.">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:title" content="UniónDev · Computadoras y accesorios en San Salvador">
<meta property="og:description" content="Laptops, monitores, impresoras y accesorios con el IVA incluido.">
<meta property="og:image" content="${SITE}/img/LAP-006.webp">
<meta property="og:url" content="${SITE}/">`, lista));

/* Una página por producto. */
for (const p of UD.P) {
  const d = UD.D[p.cod] || {}, url = `${SITE}/producto/${p.cod}`, img = `${SITE}/img/${p.cod}.webp`;
  const desc = (d.res ? d.res + ' ' : '') + `${p.sp}. $${p.precio.toFixed(2)} con IVA incluido.`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, sku: p.cod, brand: { '@type': 'Brand', name: p.marca }, image: [img], description: d.desc || desc,
    offers: { '@type': 'Offer', price: p.precio.toFixed(2), priceCurrency: 'USD', availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url, seller: { '@type': 'Organization', name: 'UNIONDEV, S.A. de C.V.' } }
  };
  const cab = `<title>${esc(p.nombre)} · UniónDev</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(p.nombre)} · UniónDev">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  const contenido = `<noscript><h1>${esc(p.nombre)}</h1><p>${esc(d.desc || desc)}</p><p>Precio: $${p.precio.toFixed(2)} (IVA incluido)</p></noscript>`;
  const dir = path.join(PUB, 'producto', p.cod);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), seo(cab, contenido));
}

const hoy = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(PUB, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [`${SITE}/`].concat(UD.P.map(p => `${SITE}/producto/${p.cod}`)).map(u => `  <url><loc>${u}</loc><lastmod>${hoy}</lastmod></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /pagar\nDisallow: /factura\nDisallow: /admin\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('Sitio compilado:', UD.P.length, 'páginas de producto ·', SITE);
