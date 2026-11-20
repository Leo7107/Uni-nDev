/* Servidor local para probar sin la CLI de Vercel: `npm run dev` y abre http://localhost:3000
   Imita a Vercel: sirve /public con URLs limpias, reescribe /pagar y /factura, y ejecuta las funciones de /api.
   Lee variables de un archivo .env si existe (mismo formato que .env.example). */
const http = require('http'), fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), PUB = path.join(R, 'public');
const envFile = path.join(R, '.env');
if (fs.existsSync(envFile)) {
  for (const linea of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
const API = {
  '/api/config': require('../api/config.js'),
  '/api/pedido': require('../api/pedido.js'),
  '/api/paypal/orden': require('../api/paypal/orden.js'),
  '/api/paypal/capturar': require('../api/paypal/capturar.js')
};
function archivo(url) {
  let p = decodeURIComponent(url.split('?')[0]);
  if (p === '/pagar' || p === '/factura') p = '/index.html';
  const candidatos = [p, p + '.html', path.join(p, 'index.html')];
  for (const c of candidatos) {
    const f = path.join(PUB, path.normalize(c));
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}
http.createServer(async (req, res) => {
  const ruta = req.url.split('?')[0];
  if (API[ruta]) { try { await API[ruta](req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end('{"error":"Error interno"}'); } return; }
  const f = archivo(req.url);
  if (!f) { res.statusCode = 404; res.end('No encontrado'); return; }
  res.setHeader('Content-Type', TIPOS[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('UniónDev en http://localhost:' + (process.env.PORT || 3000)));
