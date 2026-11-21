/* Etiquetas para buscadores (título, descripción, Open Graph y datos estructurados de producto).
   Lo usan el build (página de inicio) y la función /api/pagina (páginas de producto y sitemap). */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const abs = (site, u) => (/^https?:\/\//.test(u) ? u : site + u);

function sitio() {
  return (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000')).replace(/\/$/, '');
}

function rellenar(plantilla, cab, contenido) {
  return plantilla.replace('<!--SEO:CABECERA-->', cab).replace('<!--SEO:CONTENIDO-->', contenido || '');
}

function inicio(plantilla, C, site) {
  const visibles = C.P.filter(p => p.activo !== false);
  const lista = '<noscript><h1>UniónDev · Computadoras y accesorios en San Salvador</h1><ul>' + visibles.map(p => `<li><a href="/producto/${p.cod}">${esc(p.nombre)}</a> · $${p.precio.toFixed(2)} IVA incluido</li>`).join('') + '</ul></noscript>';
  return rellenar(plantilla, `<title>UniónDev · Computadoras y accesorios en San Salvador</title>
<meta name="description" content="Laptops, monitores, impresoras, teclados, mouse y más en San Salvador. Precios con IVA incluido, factura electrónica y entrega a domicilio.">
<link rel="canonical" href="${site}/">
<meta property="og:type" content="website">
<meta property="og:title" content="UniónDev · Computadoras y accesorios en San Salvador">
<meta property="og:description" content="Laptops, monitores, impresoras y accesorios con el IVA incluido.">
<meta property="og:image" content="${site}/img/LAP-006.webp">
<meta property="og:url" content="${site}/">`, lista);
}

function producto(plantilla, C, p, site) {
  const d = C.D[p.cod] || {}, url = `${site}/producto/${p.cod}`, img = p.foto ? abs(site, p.foto) : `${site}/img/LAP-006.webp`;
  const desc = (d.res ? d.res + ' ' : '') + `${p.sp ? p.sp + '. ' : ''}$${p.precio.toFixed(2)} con IVA incluido.`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, sku: p.cod, brand: { '@type': 'Brand', name: p.marca }, image: [img], description: d.desc || desc,
    offers: { '@type': 'Offer', price: p.precio.toFixed(2), priceCurrency: 'USD', availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url, seller: { '@type': 'Organization', name: 'UNIONDEV, S.A. de C.V.' } }
  };
  return rellenar(plantilla, `<title>${esc(p.nombre)} · UniónDev</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(p.nombre)} · UniónDev">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  `<noscript><h1>${esc(p.nombre)}</h1><p>${esc(d.desc || desc)}</p><p>Precio: $${p.precio.toFixed(2)} (IVA incluido)</p></noscript>`);
}

function sitemap(C, site) {
  const hoy = new Date().toISOString().slice(0, 10);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [`${site}/`].concat(C.P.filter(p => p.activo !== false).map(p => `${site}/producto/${p.cod}`)).map(u => `  <url><loc>${u}</loc><lastmod>${hoy}</lastmod></url>`).join('\n') + '\n</urlset>\n';
}

module.exports = { sitio, inicio, producto, sitemap };
