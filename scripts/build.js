/* Compila el sitio para Vercel:
   1. Copia los módulos compartidos de /lib a /public/js.
   2. Genera public/index.html con las etiquetas para buscadores.
   3. Genera robots.txt.
   Las páginas de producto y el sitemap los genera la función /api/pagina con el catálogo vigente (Supabase). */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), PUB = path.join(R, 'public');
const UD = require(path.join(R, 'lib', 'datos.js'));
const seo = require(path.join(R, 'lib', 'seo.js'));
const SITE = seo.sitio();

for (const f of ['datos.js', 'factura.js', 'logo.js']) fs.copyFileSync(path.join(R, 'lib', f), path.join(PUB, 'js', f));

const plantilla = fs.readFileSync(path.join(R, 'plantilla.html'), 'utf8');
fs.writeFileSync(path.join(PUB, 'index.html'), seo.inicio(plantilla, UD, SITE));
fs.writeFileSync(path.join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /pagar\nDisallow: /factura\nDisallow: /admin\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('Sitio compilado ·', SITE);
