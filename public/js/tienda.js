/* UniónDev · tienda (navegador). Depende de /js/datos.js, /js/factura.js, /js/logo.js y jsPDF. */
(function () {
  'use strict';
  /* Catálogo y factura compartidos con el servidor: /js/datos.js y /js/factura.js (copiados desde /lib al compilar). */
  var UD = window.UDDatos, UF = window.UDFactura;
  var P = UD.P, D = UD.D, COMBINA = UD.COMBINA, ESTANTES = UD.ESTANTES, RAZONES = UD.RAZONES, CATS = UD.CATS, ALM = UD.ALM, RAM = UD.RAM;
  var grupos = UD.grupos, opcion = UD.opcion, esBase = UD.esBase, precioDe = UD.precioDe, nombreVar = UD.nombreVar;

  /* ---------- utilidades ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var r2 = UD.r2;
  function money(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var by = UD.by;
  function reducido() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  var IZQ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
  var DER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

  /* Ilustración de respaldo (solo para el UPS Centra, que aún no tiene foto). */
  function arte() {
    return '<svg viewBox="0 0 240 180" aria-hidden="true"><rect x="70" y="18" width="100" height="148" rx="12" fill="#1f2229"/><rect x="84" y="34" width="72" height="34" rx="4" fill="#3c8f5a"/><path d="M124 40l-10 12h9l-5 11 13-15h-9l4-8z" fill="#fff"/><circle cx="100" cy="98" r="9" fill="#3a3f49"/><circle cx="140" cy="98" r="9" fill="#3a3f49"/><circle cx="100" cy="128" r="9" fill="#3a3f49"/><circle cx="140" cy="128" r="9" fill="#3a3f49"/><circle cx="120" cy="154" r="4" fill="#21b35b"/></svg>';
  }
  function tieneFoto(p) { return !!(p && p.foto); }
  function vis(p, src) {
    if (!tieneFoto(p) && !src) return arte();
    return '<img src="' + (src || p.foto) + '" alt="' + esc(p.nombre) + '" loading="lazy" decoding="async">';
  }

  /* ---------- versiones y precios ---------- */
  function galeria(p, sel) {
    var base = (D[p.cod] && D[p.cod].gal) || [];
    var out = null;
    grupos(p).forEach(function (gr, k) { var o = opcion(gr, sel[k] || 0); if (o.gal) out = o.gal; });
    return out || base;
  }

  /* ---------- carrito: cada línea es producto + versión ---------- */
  var carro = {};
  try { var g0 = JSON.parse(localStorage.getItem('ud-carro2') || '{}'); if (g0 && typeof g0 === 'object') carro = g0; } catch (e) {}
  function guardar() { try { localStorage.setItem('ud-carro2', JSON.stringify(carro)); } catch (e) {} }
  function clave(cod, sel) { return cod + '|' + sel.join('.'); }
  function enCarroBase(cod) { var l = carro[clave(cod, grupos(by(cod)).map(function () { return 0; }))]; return l ? l.q : 0; }
  function maxPara(p, sel) { return esBase(sel) ? p.stock - enCarroBase(p.cod) : 5 - ((carro[clave(p.cod, sel)] || {}).q || 0); }
  function etiqueta(p) {
    var q = p.stock - enCarroBase(p.cod);
    if (q <= 0) return 'Agotado por ahora';
    if (q === 1) return 'Última unidad';
    var o = precioBase(p); if (o.promo) return 'Oferta ' + rebaja(o.promo);
    if (grupos(p).some(function (gr) { return gr.color; })) return 'Más colores';
    if (p.gaming) return 'Gaming';
    return '';
  }
  function precioBase(p) { return precioDe(p, grupos(p).map(function () { return 0; })); }
  function rebaja(pr) { return pr.tipo === 'porcentaje' ? '−' + Number(pr.valor) + ' %' : '−' + money(Number(pr.valor)); }
  function hasta(iso) { try { return new Date(iso).toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador', day: 'numeric', month: 'long' }); } catch (e) { return ''; } }
  function agregar(cod, sel, cant) {
    var p = by(cod), k = clave(cod, sel), n = Math.min(cant || 1, maxPara(p, sel));
    if (n <= 0) return 0;
    carro[k] = carro[k] || { cod: cod, sel: sel.slice(), q: 0 };
    carro[k].q += n; guardar(); refrescar(cod);
    var b = $('#n'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    return n;
  }

  /* ---------- tienda ---------- */
  function tarjeta(p) {
    var q = p.stock - enCarroBase(p.cod);
    return '<article class="tarjeta" data-cod="' + p.cod + '" data-cat="' + esc(p.cat) + '">' +
      '<a class="abrir" href="/producto/' + p.cod + '" aria-label="Ver ' + esc(p.nombre) + '"><span class="arte">' + vis(p) + '</span>' +
      '<span class="etq">' + etiqueta(p) + '</span><h3>' + esc(p.nombre) + '</h3><span class="sp">' + esc(p.sp) + '</span></a>' +
      '<div class="pie">' + precioTarjeta(p) +
      '<button class="mas" type="button" data-add="' + p.cod + '" aria-label="Agregar ' + esc(p.nombre) + ' al carrito"' + (q <= 0 ? ' disabled' : '') + '>' + PLUS + '</button></div></article>';
  }
  function precioTarjeta(p) {
    var o = precioBase(p);
    return o.desc ? '<span class="precio oferta">' + money(o.tot) + ' <s>' + money(o.normal) + '</s><small>IVA incluido · ahorras ' + money(o.desc) + '</small></span>'
      : '<span class="precio">' + money(p.precio) + '<small>IVA incluido</small></span>';
  }
  /* Fotos sin fondo (public/img/sf) para las tarjetas destacadas oscuras. */
  var SIN_FONDO = ['LAP-006', 'TEC-004', 'MOU-003', 'AUD-001', 'MON-001', 'TEC-001', 'MOU-001', 'ENE-001'];
  var SECUENCIA = { 'LAP-006': ['LAP-006', 'TEC-004', 'MOU-003', 'AUD-001'], 'MON-001': ['MON-001', 'TEC-001', 'MOU-001'], 'ENE-001': ['ENE-001', 'ENE-002'] };
  function fotosPromo(pr) {
    var cods = (SECUENCIA[pr.foto] || [pr.foto]).filter(function (c) { return SIN_FONDO.indexOf(c) >= 0 || c === pr.foto; });
    return cods.map(function (c, k) { var p = by(c), src = SIN_FONDO.indexOf(c) >= 0 ? '/img/sf/' + c + '.webp' : (p && p.foto) || '/img/' + c + '.webp'; return '<img class="' + (k ? '' : 'on') + '" src="' + src + '" alt="" loading="lazy" decoding="async">'; }).join('');
  }
  /* Turna las fotos de las tarjetas destacadas que están a la vista. */
  var turnoT = null;
  function turnarFotos() {
    clearInterval(turnoT); if (reducido()) return;
    turnoT = setInterval(function () {
      if (document.hidden || vistaActual !== 'v-tienda') return;
      $$('#v-tienda .promo .arte').forEach(function (a) {
        var imgs = a.querySelectorAll('img'); if (imgs.length < 2) return;
        var r = a.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
        if (a.closest('.promo').matches(':hover')) return;
        var i = 0; imgs.forEach(function (im, k) { if (im.classList.contains('on')) i = k; });
        imgs[i].classList.remove('on'); imgs[i].classList.add('sale');
        setTimeout(function () { imgs[i].classList.remove('sale'); }, 900);
        imgs[(i + 1) % imgs.length].classList.add('on');
      });
    }, 2600);
  }
  function promo(pr) {
    var accion = pr.ir ? '<a class="ir" href="#' + pr.ir + '" aria-label="Ir a ' + esc(pr.sub) + '">' + ARROW + '</a>'
      : pr.ver ? '<a class="ir" href="/producto/' + pr.ver + '" aria-label="Ver ' + esc(pr.sub) + '">' + ARROW + '</a>'
      : '<button class="ir" type="button" data-combo aria-label="Agregar el escritorio completo al carrito">' + PLUS + '</button>';
    return '<article class="promo ' + pr.cls + '"><div class="tx"><small>' + esc(pr.sub) + '</small><h3>' + esc(pr.t) + '</h3><p>' + esc(pr.p) + '</p></div><div class="arte">' + fotosPromo(pr) + '</div>' + accion + '</article>';
  }
  function flechasHtml() { return '<button class="flecha" type="button" data-dir="-1" aria-label="Anterior">' + IZQ + '</button><button class="flecha" type="button" data-dir="1" aria-label="Siguiente">' + DER + '</button>'; }
  /* ---------- banner de ofertas (estilo cartel: letras enormes y el producto grande) ---------- */
  var ban = { i: 0, n: 0, t: null, pausa: false };
  var CORTOS = {
    laptops: ['Juega en serio.', 'Laptops con RTX para tus juegos favoritos.', 'GAMING'],
    escritorio: ['Arma tu escritorio', 'Monitor de 24", teclado y mouse desde $154.90.', 'ESCRITORIO'],
    conecta: ['Sin cortes de luz', 'Un UPS protege tu computadora y tu trabajo.', 'ENERGÍA']
  };
  function slidesBanner() {
    var out = [], pro = UD.PROMOS || [], ahora = Date.now();
    pro.forEach(function (pr) {
      if (new Date(pr.inicio) > ahora || new Date(pr.fin) <= ahora) return;
      var af = P.filter(function (p) { var x = UD.promoDe(p); return p.activo !== false && x && x.id === pr.id; });
      if (!af.length) return;
      var p = af.filter(tieneFoto).sort(function (a, b) { return b.precio - a.precio; })[0] || af[0], o = precioBase(p);
      var donde = pr.alcance === 'producto' ? p.nombre : pr.alcance === 'categoria' ? 'En ' + pr.objetivo.toLowerCase() : 'En toda la tienda';
      out.push({ eyebrow: 'Hasta el ' + hasta(pr.fin), t: pr.nombre, big: rebaja(pr), fondo: pr.alcance === 'categoria' ? pr.objetivo.toUpperCase() : 'OFERTA', p: p,
        sub: esc(donde) + (pr.alcance === 'producto' ? '' : ' · ' + esc(p.nombre)) + ' a <b>' + money(o.tot) + '</b> <s>' + money(o.normal) + '</s>',
        cta: pr.alcance === 'producto' ? '<a class="btn b-cta" href="/producto/' + p.cod + '">Comprar ahora</a>' : '<a class="btn b-cta" href="#" data-cat-ir="' + esc(pr.alcance === 'categoria' ? pr.objetivo : 'Laptops') + '">Ver ofertas</a>' });
    });
    Object.keys(ESTANTES).forEach(function (k) {
      var e = ESTANTES[k].promo, c = ESTANTES[k].cats[0], p = by(e.foto), x = CORTOS[k] || [e.t, e.p, c.toUpperCase()]; if (!p) return;
      out.push({ eyebrow: e.sub, t: x[0], big: '', sub: esc(x[1]), fondo: x[2], p: p,
        cta: e.ver && by(e.ver) ? '<a class="btn b-cta" href="/producto/' + e.ver + '">Ver ' + esc(by(e.ver).nombre) + '</a>' : '<a class="btn b-cta" href="#" data-cat-ir="' + esc(c) + '">Ver ' + esc(c.toLowerCase()) + '</a>' });
    });
    return out.slice(0, 5);
  }
  function pintarBanner() {
    var S = slidesBanner(); ban.n = S.length; ban.i = Math.max(0, Math.min(ban.i, S.length - 1));
    $('#b-slides').innerHTML = S.map(function (s, k) {
      return '<div class="b-slide t' + (k % 4) + '" role="group" aria-roledescription="diapositiva" aria-label="' + (k + 1) + ' de ' + S.length + '"><div class="wrap b-in">' +
        '<div class="b-tx"><small>' + esc(s.eyebrow) + '</small><h2' + (s.t.length > 16 ? ' class="largo"' : '') + '>' + esc(s.t) + '</h2>' + (s.big ? '<p class="b-big">' + s.big + '</p>' : '') + '<p class="b-sub">' + s.sub + '</p>' + s.cta + '</div>' +
        '<div class="b-arte"><span class="b-disco" aria-hidden="true"></span><span class="b-aro" aria-hidden="true"></span>' + vis(s.p) + '</div></div></div>';
    }).join('');
    $('#b-ctrl').innerHTML = S.length > 1 ? '<div class="b-pasos">' + S.map(function (s, k) { return '<button type="button" data-paso="' + k + '" aria-label="Ver oferta ' + (k + 1) + '"><i></i></button>'; }).join('') + '</div>' +
      '<div class="b-fl"><button class="flecha" type="button" data-bdir="-1" aria-label="Oferta anterior">' + IZQ + '</button><button class="flecha" type="button" data-bdir="1" aria-label="Oferta siguiente">' + DER + '</button></div>' : '';
    irSlide(ban.i);
  }
  function irSlide(n) {
    if (!ban.n) return;
    ban.i = (n + ban.n) % ban.n;
    $$('#b-slides .b-slide').forEach(function (s, k) {
      var on = k === ban.i; s.classList.toggle('on', on);
      if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      $$('a,button', s).forEach(function (a) { a.tabIndex = on ? 0 : -1; });
    });
    $$('#b-ctrl [data-paso]').forEach(function (b, k) {
      b.classList.remove('on', 'visto'); if (k < ban.i) b.classList.add('visto');
      if (k === ban.i) { void b.offsetWidth; b.classList.add('on'); }
      b.setAttribute('aria-current', k === ban.i ? 'true' : 'false');
    });
    programar();
  }
  function programar() {
    clearTimeout(ban.t); $('#inicio').classList.toggle('pausa', ban.pausa);
    if (!ban.pausa && ban.n > 1 && !reducido()) ban.t = setTimeout(function () { irSlide(ban.i + 1); }, 4500);
  }
  function pintarTienda() {
    pintarBanner(); turnarFotos();
    Object.keys(ESTANTES).forEach(function (k) {
      var e = ESTANTES[k], html = P.filter(function (p) { return e.cats.indexOf(p.cat) >= 0; }).map(tarjeta);
      html.splice(Math.min(e.promo.pos, html.length), 0, promo(e.promo));
      $('[data-fila="' + k + '"]').innerHTML = html.join('');
    });
    $('#cats').innerHTML = CATS.map(function (c) {
      var ej = P.filter(function (p) { return p.cat === c[0]; })[0];
      return '<button class="cat" type="button" data-cat-ir="' + esc(c[0]) + '">' + vis(ej) + '<span>' + (c[0] === 'Audio y video' ? 'Audio' : esc(c[0])) + '</span></button>';
    }).join('');
    $$('#v-tienda [data-flechas]').forEach(function (f) { f.innerHTML = flechasHtml(); });
    $$('#v-tienda .fila').forEach(actFlechas);
  }
  function actFlechas(fila) {
    var f = fila.parentNode.querySelector('[data-flechas="' + fila.dataset.fila + '"]'); if (!f) return;
    var b = f.querySelectorAll('button'); if (b.length < 2) return;
    b[0].disabled = fila.scrollLeft < 8;
    b[1].disabled = fila.scrollLeft + fila.clientWidth >= fila.scrollWidth - 8;
  }
  function refrescar(cod) {
    $$('.tarjeta[data-cod="' + cod + '"]').forEach(function (t) {
      var p = by(cod); $('.etq', t).textContent = etiqueta(p); $('.mas', t).disabled = p.stock - enCarroBase(cod) <= 0;
    });
    pintarPanel();
    if (vista.cod === cod) pintarCompra();
  }
  function irCat(cat) {
    var s = CATS.filter(function (c) { return c[0] === cat; })[0]; if (!s) return;
    var abrir = function () {
      var sec = document.getElementById(s[1]);
      sec.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth' });
      var fila = $('.fila', sec), t = fila && fila.querySelector('.tarjeta[data-cat="' + cat + '"]');
      if (t) setTimeout(function () { fila.scrollTo({ left: t.offsetLeft - parseFloat(getComputedStyle(fila).paddingLeft) }); }, 250);
    };
    if (vistaActual !== 'v-tienda') { navegar('/#' + s[1]); setTimeout(abrir, 30); } else abrir();
  }

  /* ---------- página de producto ---------- */
  var vista = { cod: null, sel: [], img: 0, cant: 1 };
  function pintarProducto(cod) {
    var p = by(cod), d = D[cod] || {};
    vista = { cod: cod, sel: grupos(p).map(function () { return 0; }), img: 0, cant: 1 };
    var catSec = CATS.filter(function (c) { return c[0] === p.cat; })[0][1];
    var mismos = P.filter(function (x) { return x.cat === p.cat && x.cod !== cod; });
    var combina = [];
    (COMBINA[p.cat] || []).forEach(function (c) { P.forEach(function (x) { if (x.cat === c && x.cod !== cod && mismos.indexOf(x) < 0 && combina.indexOf(x) < 0) combina.push(x); }); });
    if (mismos.length < 2) { mismos = mismos.concat(combina.splice(0, 4 - mismos.length)); }
    combina = combina.slice(0, 8);

    $('#v-producto').innerHTML =
      '<nav class="wrap migas" aria-label="Ruta"><a href="/">Tienda</a><span aria-hidden="true">›</span><a href="#' + catSec + '" data-cat-ir="' + esc(p.cat) + '">' + esc(p.cat) + '</a><span aria-hidden="true">›</span><b>' + esc(p.nombre) + '</b></nav>' +
      '<div class="wrap pdp">' +
        '<div class="galeria" id="galeria"></div>' +
        '<div class="compra" id="compra"></div>' +
      '</div>' +
      '<section class="wrap bloque" aria-labelledby="t-desc"><h2 id="t-desc"><b>Descripción.</b> <span>' + esc(d.res || p.sp) + '</span></h2>' +
        '<p class="lead">' + esc(d.desc || '') + '</p>' +
        '<div class="puntos">' + (d.puntos || []).map(function (x, i) { return '<div class="punto"><span class="n">0' + (i + 1) + '</span><h3>' + esc(x[0]) + '</h3><p>' + esc(x[1]) + '</p></div>'; }).join('') + '</div></section>' +
      '<section class="wrap bloque" aria-labelledby="t-specs"><h2 id="t-specs"><b>Especificaciones.</b> <span>Lo técnico, en claro.</span></h2>' +
        '<dl class="specs" id="specs"></dl></section>' +
      (mismos.length ? '<section class="estante"><div class="wrap"><h2><b>Más de ' + esc(p.cat.toLowerCase()) + '.</b> <span>Compara antes de decidir.</span></h2></div><div class="fila" data-fila="r1">' + mismos.map(tarjeta).join('') + '</div><div class="wrap flechas" data-flechas="r1">' + flechasHtml() + '</div></section>' : '') +
      (combina.length ? '<section class="estante"><div class="wrap"><h2><b>Combínalo con.</b> <span>Lo que suele acompañar a este producto.</span></h2></div><div class="fila" data-fila="r2">' + combina.map(tarjeta).join('') + '</div><div class="wrap flechas" data-flechas="r2">' + flechasHtml() + '</div></section>' : '');
    pintarGaleria(); pintarCompra(); pintarSpecs();
    $$('#v-producto .fila').forEach(function (f) { actFlechas(f); f.addEventListener('scroll', function () { actFlechas(f); }, { passive: true }); });
    document.title = p.nombre + ' · UniónDev';
  }
  /* La tabla refleja la versión elegida: almacenamiento, memoria, capacidad, color, etc. */
  function specsDe(p, sel) {
    var out = [['Marca', p.marca], ['Código', p.cod]].concat(((D[p.cod] || {}).specs || []).map(function (s) { return s.slice(); }));
    function fila(k) { for (var i = 0; i < out.length; i++) if (out[i][0] === k) return out[i]; return null; }
    function talla(txt) { var m = /\d+(\.\d+)?\s?(GB|TB)/.exec(txt); return m ? m[0] : txt; }
    grupos(p).forEach(function (gr, k) {
      var o = opcion(gr, sel[k] || 0); if (o.ir) return;
      var clave = gr.t === RAM ? 'Memoria' : gr.t, f = fila(clave);
      if ((gr.t === ALM || gr.t === RAM || gr.t === 'Capacidad') && f) f[1] = f[1].replace(/\d+(\.\d+)?\s?(GB|TB)/, talla(o.n));
      else if (f) f[1] = o.n;
      else out.splice(2, 0, [clave, o.n]);
    });
    if (!esBase(sel)) out.push(['Disponibilidad', 'Por encargo, 5 a 7 días hábiles']);
    return out;
  }
  function pintarSpecs() {
    var el = $('#specs'); if (!el) return;
    el.innerHTML = specsDe(by(vista.cod), vista.sel).map(function (s) { return '<dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd>'; }).join('');
  }
  function pintarGaleria() {
    var p = by(vista.cod), fotos = galeria(p, vista.sel), el = $('#galeria');
    if (vista.img >= fotos.length) vista.img = 0;
    if (!fotos.length) { el.innerHTML = '<div class="g-main">' + arte() + '</div>'; return; }
    el.innerHTML = '<div class="g-main">' + vis(p, fotos[vista.img]) +
      (fotos.length > 1 ? '<button class="g-nav prev" type="button" data-gal="-1" aria-label="Foto anterior">' + IZQ + '</button><button class="g-nav next" type="button" data-gal="1" aria-label="Foto siguiente">' + DER + '</button><span class="g-cont">' + (vista.img + 1) + ' / ' + fotos.length + '</span>' : '') + '</div>' +
      (fotos.length > 1 ? '<div class="g-thumbs" role="group" aria-label="Fotos del producto">' + fotos.map(function (f, i) { return '<button type="button" data-foto="' + i + '" aria-label="Foto ' + (i + 1) + '" aria-current="' + (i === vista.img) + '"><img src="' + f + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '');
  }
  function pintarCompra() {
    var p = by(vista.cod), pr = precioDe(p, vista.sel), base = esBase(vista.sel), max = maxPara(p, vista.sel);
    if (vista.cant > Math.max(1, max)) vista.cant = Math.max(1, max);
    var disp = base
      ? (max > 0 ? '<i></i><div><b>' + (p.stock - enCarroBase(p.cod)) + (p.stock - enCarroBase(p.cod) === 1 ? ' unidad disponible' : ' unidades disponibles') + '</b><br><span>Entrega inmediata en tienda o a domicilio.</span></div>'
                 : '<i class="no"></i><div><b>Agotado por ahora</b><br><span>' + (p.stock > 0 && enCarroBase(p.cod) ? 'Ya tienes en tu carrito todas las unidades disponibles.' : 'Pregúntanos por la fecha de reposición' + (grupos(p).length ? ' o elige una versión por encargo.' : '.')) + '</span></div>')
      : '<i class="encargo"></i><div><b>Por encargo</b><br><span>Esta versión llega en 5 a 7 días hábiles. El precio ya incluye el IVA.</span></div>';
    var gs = grupos(p).map(function (gr, k) {
      var sel = opcion(gr, vista.sel[k]);
      if (gr.color) {
        return '<div class="grupo"><span class="grupo-t">' + esc(gr.t) + ': <span>' + esc(sel.n) + '</span></span><div class="swatches">' + gr.ops.map(function (o, i) {
          return '<button class="sw" type="button" style="--c:' + o[2] + '" data-grupo="' + k + '" data-op="' + i + '" aria-pressed="' + (vista.sel[k] === i) + '" aria-label="' + esc(o[0]) + '" title="' + esc(o[0]) + '"></button>';
        }).join('') + '</div></div>';
      }
      return '<div class="grupo"><span class="grupo-t">' + esc(gr.t) + '</span><div class="chips">' + gr.ops.map(function (o, i) {
        var op = opcion(gr, i), nota;
        if (op.ir) { var q = by(op.ir); nota = 'Ver · ' + money(q.precio); }
        else if (i === 0) nota = 'Disponible';
        else nota = op.d === 0 ? 'Mismo precio · por encargo' : (op.d > 0 ? '+' : '−') + money(Math.abs(op.d)) + ' · por encargo';
        return '<button class="chip' + (op.ir ? ' ir' : '') + '" type="button" data-grupo="' + k + '" data-op="' + i + '" aria-pressed="' + (!op.ir && vista.sel[k] === i) + '"><b>' + esc(op.n) + '</b><small>' + nota + '</small></button>';
      }).join('') + '</div></div>';
    }).join('');
    $('#compra').innerHTML =
      '<span class="etq">' + (etiqueta(p) || esc(p.marca)) + '</span>' +
      '<h1>' + esc(p.nombre) + '</h1><p class="res">' + esc(p.sp) + '</p>' +
      '<div class="precio-g">' + (pr.promo ? '<p class="oferta-g"><b>' + esc(pr.promo.nombre) + ' · ' + rebaja(pr.promo) + '</b> hasta el ' + hasta(pr.promo.fin) + '</p>' : '') + '<strong>' + money(pr.tot) + (pr.desc ? ' <s>' + money(pr.normal) + '</s>' : '') + '</strong>' + (pr.desc ? '<span class="ahorro">Ahorras ' + money(pr.desc) + '</span>' : '') + '<span>IVA incluido · Precio sin IVA ' + money(pr.sin) + ' · IVA (13 %) ' + money(pr.iva) + '</span></div>' +
      gs +
      '<div class="disp">' + disp + '</div>' +
      '<div class="accion"><div class="cant" aria-label="Cantidad"><button type="button" data-cant="-1" aria-label="Menos"' + (vista.cant <= 1 ? ' disabled' : '') + '>−</button><span>' + vista.cant + '</span><button type="button" data-cant="1" aria-label="Más"' + (vista.cant >= max ? ' disabled' : '') + '>+</button></div>' +
        '<button class="btn" type="button" id="agregar"' + (max <= 0 ? ' disabled' : '') + '>Agregar al carrito</button></div>' +
      '<ul class="extras">' +
        '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg><span><b>Factura de consumidor final</b> en tu correo al comprar.</span></li>' +
        '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/></svg><span><b>Garantía de fábrica ' + esc(p.marca) + '.</b></span></li>' +
        '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg><span><b>Recoge en San Salvador</b> o pide entrega a domicilio.</span></li>' +
      '</ul>';
  }

  /* ---------- rutas: #producto-CÓDIGO abre la página del producto ---------- */
  var vistaActual = 'v-tienda';
  function menuTransparente() { var t = $('.top'); if (t) t.classList.toggle('sobre', vistaActual === 'v-tienda' && scrollY < 24); }
  window.addEventListener('scroll', menuTransparente, { passive: true });
  function mostrar(id) { vistaActual = id; ['v-tienda', 'v-producto', 'v-pagar', 'v-factura'].forEach(function (x) { $('#' + x).hidden = x !== id; }); menuTransparente(); }
  function navegar(url) { history.pushState(null, '', url); ruta(); }
  function ruta() {
    $('#toast').hidden = true;
    var path = location.pathname.replace(/\/+$/, '') || '/';
    var m = /^\/producto\/([A-Za-z]{3}-\d{3})$/.exec(path), p = m && by(m[1].toUpperCase());
    if (p) {
      mostrar('v-producto'); pintarProducto(p.cod); window.scrollTo(0, 0);
    } else if (path === '/pagar') {
      vista = { cod: null, sel: [], img: 0, cant: 1 };
      mostrar('v-pagar'); pintarPagar(); document.title = 'Pagar · UniónDev'; window.scrollTo(0, 0);
    } else if (path === '/factura') {
      vista = { cod: null, sel: [], img: 0, cant: 1 };
      mostrar('v-factura'); pintarFactura(); document.title = 'Tu factura · UniónDev'; window.scrollTo(0, 0);
    } else {
      var venia = vista.cod; vista = { cod: null, sel: [], img: 0, cant: 1 };
      mostrar('v-tienda'); document.title = 'UniónDev · Computadoras y accesorios en San Salvador';
      var destino = location.hash && document.getElementById(location.hash.slice(1));
      if (!destino && venia) { var c = by(venia); destino = document.getElementById(CATS.filter(function (x) { return x[0] === c.cat; })[0][1]); }
      if (destino) setTimeout(function () { destino.scrollIntoView(); }, 0); else if (!location.hash) window.scrollTo(0, 0);
      $$('#v-tienda .fila').forEach(actFlechas);
    }
  }
  /* Enlaces internos sin recargar la página. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]'); if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    var h = a.getAttribute('href');
    if (a.dataset.catIr) return;
    if (h.charAt(0) === '/') { e.preventDefault(); if (a.hasAttribute('data-cerrar-panel')) cerrarPanel(); navegar(h); }
    else if (h.charAt(0) === '#' && vistaActual !== 'v-tienda') { e.preventDefault(); navegar('/' + h); }
  }, true);

  /* ---------- carrito (panel) ---------- */
  var panel = $('#panel'), scrim = $('#scrim'), focoPrevio = null;
  function lineas() { return Object.keys(carro).filter(function (k) { return carro[k] && by(carro[k].cod); }); }
  function totales() {
    var t = 0, iva = 0, n = 0;
    lineas().forEach(function (k) { var l = carro[k], pr = precioDe(by(l.cod), l.sel); t += pr.tot * l.q; iva += pr.iva * l.q; n += l.q; });
    return { t: r2(t), iva: r2(iva), n: n };
  }
  function pintarPanel() {
    var tt = totales(), n = $('#n'); n.hidden = tt.n === 0; n.textContent = tt.n;
    var ks = lineas();
    var cuerpo = !ks.length
      ? '<div class="vacia"><b>Tu carrito está vacío</b><span>Toca + en cualquier producto para agregarlo.</span><button class="btn" type="button" data-cerrar-panel>Seguir comprando</button></div>'
      : '<div class="items">' + ks.map(function (k) {
          var l = carro[k], p = by(l.cod), pr = precioDe(p, l.sel), fotos = galeria(p, l.sel), vn = nombreVar(p, l.sel);
          var max = esBase(l.sel) ? p.stock : 5;
          return '<div class="item"><a class="mini" href="/producto/' + p.cod + '" data-cerrar-panel aria-label="Ver ' + esc(p.nombre) + '">' + vis(p, fotos[0]) + '</a><div><b>' + esc(p.nombre) + '</b>' + (vn ? '<span class="var">' + esc(vn) + (esBase(l.sel) ? '' : ' · por encargo') + '</span>' : '') +
            (pr.desc ? '<span class="var ahorro">' + esc(pr.promo.nombre) + ' · ahorras ' + money(r2(pr.desc * l.q)) + '</span>' : '') +
            (esBase(l.sel) && l.q > p.stock ? '<span class="var" style="color:var(--accent)">' + (p.stock === 0 ? 'Agotado: quítalo para pagar' : 'Solo quedan ' + p.stock) + '</span>' : '') +
            '<span class="q"><button type="button" data-menos="' + k + '" aria-label="Quitar una"' + (l.q <= 1 ? ' disabled' : '') + '>−</button><span>' + l.q + '</span><button type="button" data-mas1="' + k + '" aria-label="Agregar una"' + (l.q >= max ? ' disabled' : '') + '>+</button></span></div>' +
            '<div class="v">' + money(r2(pr.tot * l.q)) + '<button type="button" data-quitar="' + k + '">Quitar</button></div></div>';
        }).join('') + '</div>' +
        '<div class="resumen"><div><span>Subtotal</span><span>' + money(tt.t) + '</span></div><div><span>IVA incluido (13 %)</span><span>' + money(tt.iva) + '</span></div><div><span>Entrega</span><span>Se calcula al pagar</span></div>' +
        '<div class="tot"><span>Total</span><span>' + money(tt.t) + '</span></div><button class="btn" type="button" id="pagar">Ir a pagar</button><p>Recibirás tu factura de consumidor final por correo.</p></div>';
    panel.innerHTML = '<div class="panel-enc"><h2>Tu carrito</h2><button class="x" type="button" data-cerrar-panel aria-label="Cerrar carrito">×</button></div>' + cuerpo;
  }
  function abrirPanel() { focoPrevio = document.activeElement; scrim.hidden = false; panel.classList.add('abierto'); panel.setAttribute('aria-hidden', 'false'); var b = $('[data-cerrar-panel]', panel); if (b) b.focus(); }
  function cerrarPanel() { scrim.hidden = true; panel.classList.remove('abierto'); panel.setAttribute('aria-hidden', 'true'); if (focoPrevio && focoPrevio.focus) focoPrevio.focus(); }
  var toastT = null;
  function avisar(txt) {
    var t = $('#toast'); t.innerHTML = '<span>' + esc(txt) + '</span><button type="button" id="ver-carro">Ver carrito</button>'; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* ---------- pago ---------- */
  var EMPRESA = UF.EMPRESA, ENVIO = UF.ENVIO, MUNICIPIOS = UF.MUNICIPIOS;
  var chk = { nombre: '', correo: '', tel: '', dui: '', entrega: 'tienda', municipio: MUNICIPIOS[0], dir: '', ref: '', pago: 'tarjeta', tnum: '', tnom: '', texp: '', tcvv: '' };
  var NO_GUARDAR = { tnum: 1, tnom: 1, texp: 1, tcvv: 1 }; /* los datos de tarjeta solo viven en memoria */
  var PRUEBA = UF.PRUEBA; /* tarjetas de la pasarela de prueba (no hay cobro real) */

  try { var c0 = JSON.parse(localStorage.getItem('ud-pago') || 'null'); if (c0 && typeof c0 === 'object') Object.keys(chk).forEach(function (k) { if (!NO_GUARDAR[k] && typeof c0[k] === 'string') chk[k] = c0[k]; }); } catch (e) {}
  function guardarChk() { try { var o = {}; Object.keys(chk).forEach(function (k) { if (!NO_GUARDAR[k]) o[k] = chk[k]; }); localStorage.setItem('ud-pago', JSON.stringify(o)); } catch (e) {} }
  var errores = {};
  var REGLAS = {
    nombre: function (v) { return v.trim().length >= 3 ? '' : 'Escribe tu nombre completo, como debe aparecer en la factura.'; },
    correo: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Escribe un correo válido, por ejemplo nombre@correo.com. Ahí te enviaremos la factura.'; },
    tel: function (v) { var d = v.replace(/\D/g, ''); if (!d) return chk.entrega === 'domicilio' ? 'Para la entrega necesitamos un teléfono de 8 dígitos.' : ''; return d.length === 8 ? '' : 'El teléfono debe tener 8 dígitos, por ejemplo 7123-4567.'; },
    dui: function (v) { return !v.trim() || /^\d{8}-\d$/.test(v.trim()) ? '' : 'El DUI lleva 8 dígitos, un guion y 1 dígito: 01234567-8.'; },
    dir: function (v) { return chk.entrega !== 'domicilio' || v.trim().length >= 8 ? '' : 'Escribe la dirección de entrega: colonia, calle y número de casa.'; },
    tnum: function (v) { if (chk.pago !== 'tarjeta') return ''; var d = v.replace(/\D/g, ''); if (d.length < 16) return 'Escribe los 16 dígitos de la tarjeta.'; return PRUEBA[d] ? '' : 'Modo de prueba: usa una de las tarjetas de prueba de la lista. No escribas una tarjeta real.'; },
    tnom: function (v) { return chk.pago !== 'tarjeta' || v.trim().length >= 3 ? '' : 'Escribe el nombre como aparece en la tarjeta.'; },
    texp: function (v) { if (chk.pago !== 'tarjeta') return ''; var m = /^(\d{2})\/(\d{2})$/.exec(v.trim()); if (!m || +m[1] < 1 || +m[1] > 12) return 'Usa el formato MM/AA, por ejemplo 08/28.'; var hoy = new Date(), a = 2000 + +m[2]; return (a > hoy.getFullYear() || (a === hoy.getFullYear() && +m[1] >= hoy.getMonth() + 1)) ? '' : 'Esta tarjeta ya venció. Usa una fecha futura.'; },
    tcvv: function (v) { return chk.pago !== 'tarjeta' || /^\d{3}$/.test(v.trim()) ? '' : 'El código de seguridad son los 3 dígitos del reverso.'; }
  };
  function marcaDe(d) { return PRUEBA[d] ? PRUEBA[d].marca : (/^5[1-5]/.test(d) ? 'Mastercard' : (/^4/.test(d) ? 'Visa' : '')); }
  function formatoNum(v) { return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '); }
  function formatoExp(v) { var d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; }
  function pintarCV() {
    var d = chk.tnum.replace(/\D/g, ''), n = (d + '################').slice(0, 16).replace(/#/g, '•').replace(/(.{4})/g, '$1 ').trim();
    var set = function (sel, t) { var el = $(sel); if (el) el.textContent = t; };
    set('#cv-num', n); set('#cv-marca', marcaDe(d) || 'TARJETA'); set('#cv-nom', chk.tnom.trim() || 'NOMBRE APELLIDO'); set('#cv-exp', chk.texp || 'MM/AA');
  }
  function pasoPago(entrega) {
    var tj = chk.pago === 'tarjeta';
    return '<section class="paso"><div class="paso-t"><span>3</span><h2>Forma de pago</h2></div><div class="opciones">' +
      '<button class="opt" type="button" data-metodo="paypal" aria-pressed="' + (chk.pago === 'paypal') + '"><b>PayPal</b><small>Con tu cuenta PayPal o con tarjeta a través de PayPal (Sandbox).</small></button>' +
      '<button class="opt" type="button" data-metodo="tarjeta" aria-pressed="' + tj + '"><b>Tarjeta de prueba</b><small>Débito o crédito con la pasarela de prueba de la tienda.</small></button>' +
      '<button class="opt" type="button" data-metodo="efectivo" aria-pressed="' + (chk.pago === 'efectivo') + '"><b>Efectivo</b><small>' + (entrega ? 'Pagas al recibir tu pedido.' : 'Pagas al recoger en la tienda.') + '</small></button>' +
      '<button class="opt" type="button" data-metodo="transferencia" aria-pressed="' + (chk.pago === 'transferencia') + '"><b>Transferencia</b><small>Te mostramos la cuenta al confirmar.</small></button>' +
      '</div>' + (tj ?
      '<p class="modo-prueba"><span aria-hidden="true">⚠</span><span><b>Modo de prueba.</b> Ningún cobro es real y la página solo acepta las tarjetas de prueba de la lista. No escribas los datos de una tarjeta real.</span></p>' +
      '<div class="tarjeta-pago"><div class="campos">' +
        campo('tnum', 'Número de tarjeta', 'text', { modo: 'numeric', ph: '4242 4242 4242 4242', full: true, auto: 'off' }) +
        campo('tnom', 'Nombre en la tarjeta', 'text', { full: true, auto: 'off' }) +
        campo('texp', 'Vencimiento', 'text', { modo: 'numeric', ph: 'MM/AA', auto: 'off' }) +
        campo('tcvv', 'Código de seguridad', 'password', { modo: 'numeric', ph: '123', auto: 'off' }) +
      '</div><div class="pruebas"><div class="cv" aria-hidden="true"><div class="fila-cv"><span class="chip-cv"></span><span class="marca-cv" id="cv-marca">TARJETA</span></div><div class="num-cv" id="cv-num">•••• •••• •••• ••••</div><div class="fila-cv"><div><small>Titular</small><span class="dato" id="cv-nom">NOMBRE APELLIDO</span></div><div><small>Vence</small><span class="dato" id="cv-exp">MM/AA</span></div></div></div>' +
        '<p>Tarjetas de prueba (toca una para usarla). Vencimiento: cualquier fecha futura. Código: 3 dígitos.</p>' +
        Object.keys(PRUEBA).map(function (k) { return '<button class="prueba" type="button" data-prueba="' + k + '"><code>' + formatoNum(k) + '</code><span>' + PRUEBA[k].marca + ' · ' + PRUEBA[k].txt + '</span></button>'; }).join('') +
      '</div></div>' : '') + '</section>';
  }
  function cuenta() {
    var ls = lineas().map(function (k) { var l = carro[k], p = by(l.cod), pr = precioDe(p, l.sel); return { l: l, p: p, pr: pr, nom: nombreVar(p, l.sel) }; });
    var sub = r2(ls.reduce(function (a, x) { return a + x.pr.tot * x.l.q; }, 0));
    var ivaProd = r2(ls.reduce(function (a, x) { return a + x.pr.iva * x.l.q; }, 0));
    var envio = chk.entrega === 'domicilio' ? ENVIO : 0, ivaEnvio = r2(envio - envio / 1.13);
    return { ls: ls, sub: sub, envio: envio, total: r2(sub + envio), iva: r2(ivaProd + ivaEnvio) };
  }
  function campo(id, label, tipo, opc) {
    opc = opc || {};
    var err = errores[id] || '';
    var attrs = ' id="f-' + id + '" name="ud-' + id + '" data-campo="' + id + '"' + (opc.auto ? ' autocomplete="' + opc.auto + '"' : '') + (opc.modo ? ' inputmode="' + opc.modo + '"' : '') + (err ? ' aria-invalid="true" aria-describedby="e-' + id + '"' : '');
    var ctl = tipo === 'textarea' ? '<textarea' + attrs + '>' + esc(chk[id]) + '</textarea>'
      : tipo === 'select' ? '<select' + attrs + '>' + opc.lista.map(function (o) { return '<option' + (o === chk[id] ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'
      : '<input type="' + tipo + '"' + attrs + ' value="' + esc(chk[id]) + '"' + (opc.ph ? ' placeholder="' + esc(opc.ph) + '"' : '') + '>';
    return '<div class="campo' + (opc.full ? ' full' : '') + '"><label for="f-' + id + '">' + label + '</label>' + ctl +
      (opc.ayuda ? '<span class="ayuda-t">' + opc.ayuda + '</span>' : '') + '<span class="err" id="e-' + id + '"' + (err ? '' : ' hidden') + '>' + esc(err) + '</span></div>';
  }
  function pintarPagar(msg) {
    var c = cuenta(), el = $('#v-pagar');
    if (!c.ls.length) {
      el.innerHTML = '<div class="wrap pago-cab"><h1>Tu carrito está vacío.</h1><p>Agrega productos para continuar con el pago.</p><p style="margin-top:18px"><a class="btn" href="/">Ir a la tienda</a></p></div>';
      return;
    }
    var entrega = chk.entrega === 'domicilio';
    el.innerHTML =
      '<div class="wrap pago-cab"><nav class="migas" aria-label="Ruta" style="padding-top:0"><a href="/">Tienda</a><span aria-hidden="true">›</span><b>Pagar</b></nav><h1>Finaliza tu compra.</h1><p>Tres pasos y recibes tu factura de consumidor final.</p></div>' +
      '<div class="wrap pago">' +
      '<form id="form-pago" novalidate>' +
        '<section class="paso"><div class="paso-t"><span>1</span><h2>Tus datos</h2></div><div class="campos">' +
          campo('nombre', 'Nombre completo', 'text', { auto: 'name', full: true, ayuda: 'Así aparecerá en tu factura.' }) +
          campo('correo', 'Correo electrónico', 'email', { auto: 'email', modo: 'email' }) +
          campo('tel', 'Teléfono <small>(obligatorio para entrega)</small>', 'tel', { auto: 'tel', modo: 'tel', ph: '7123-4567' }) +
          campo('dui', 'DUI <small>(opcional)</small>', 'text', { modo: 'numeric', ph: '01234567-8' }) +
        '</div></section>' +
        '<section class="paso"><div class="paso-t"><span>2</span><h2>Entrega</h2></div><div class="opciones">' +
          '<button class="opt" type="button" data-entrega="tienda" aria-pressed="' + !entrega + '"><b>Recoger en tienda <em>Gratis</em></b><small>Listo en 2 horas en nuestra tienda de San Salvador.</small></button>' +
          '<button class="opt" type="button" data-entrega="domicilio" aria-pressed="' + entrega + '"><b>Entrega a domicilio <em>' + money(ENVIO) + '</em></b><small>Área de San Salvador, en 24 a 48 horas.</small></button>' +
        '</div>' + (entrega ? '<div class="campos">' + campo('municipio', 'Municipio', 'select', { lista: MUNICIPIOS }) + campo('dir', 'Dirección', 'text', { auto: 'street-address', ph: 'Colonia, calle, número de casa' }) + campo('ref', 'Punto de referencia <small>(opcional)</small>', 'textarea', { full: true }) + '</div>' : '') +
        '</section>' +
        pasoPago(entrega) +
      '</form>' +
      '<aside class="orden" aria-labelledby="t-orden"><h2 id="t-orden">Tu pedido</h2><div class="o-items">' + c.ls.map(function (x) {
          return '<div class="o-item"><span class="mini">' + vis(x.p, galeria(x.p, x.l.sel)[0]) + '</span><div><b>' + esc(x.p.nombre) + '</b><span>' + x.l.q + ' × ' + money(x.pr.tot) + (x.nom ? ' · ' + esc(x.nom) : '') + '</span></div><span class="v">' + money(r2(x.pr.tot * x.l.q)) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="o-sum"><div><span>Productos</span><span>' + money(c.sub) + '</span></div><div><span>Entrega</span><span>' + (c.envio ? money(c.envio) : 'Gratis') + '</span></div><div><span>IVA incluido (13 %)</span><span>' + money(c.iva) + '</span></div><div class="tot"><span>Total</span><span>' + money(c.total) + '</span></div></div>' +
        (msg ? '<p class="aviso-err" role="alert">' + esc(msg) + '</p>' : '') +
        (chk.pago === 'paypal' ? '<div id="paypal-botones"></div><p class="legal" id="paypal-estado" role="status"></p>'
          : '<button class="btn" type="button" id="confirmar">' + (chk.pago === 'tarjeta' ? 'Pagar ' : 'Confirmar compra · ') + money(c.total) + '</button>') +
        '<p class="legal">Al confirmar se emite tu factura de consumidor final a nombre de ' + (chk.nombre.trim() ? esc(chk.nombre.trim()) : 'quien escribas en el paso 1') + '.</p></aside>' +
      '</div>';
    pintarCV();
    if (chk.pago === 'paypal') montarPayPal();
  }
  function validar(id) {
    var f = REGLAS[id]; if (!f) return '';
    var e = f(chk[id] || ''); if (e) errores[id] = e; else delete errores[id];
    var inp = $('#f-' + id), sp = $('#e-' + id);
    if (inp) { if (e) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 'e-' + id); } else { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); } }
    if (sp) { sp.textContent = e; sp.hidden = !e; }
    return e;
  }
  document.addEventListener('input', function (e) {
    var id = e.target.dataset && e.target.dataset.campo; if (!id) return;
    if (id === 'tnum') { e.target.value = formatoNum(e.target.value); }
    if (id === 'texp') { e.target.value = formatoExp(e.target.value); }
    if (id === 'tcvv') { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); }
    chk[id] = e.target.value; guardarChk();
    if (id.charAt(0) === 't' && id !== 'tel') pintarCV();
    if (errores[id] && !REGLAS[id](chk[id])) validar(id); /* el error se borra apenas se corrige */
    if (id === 'nombre') { var lg = $('.orden .legal'); if (lg) lg.textContent = 'Al confirmar se emite tu factura de consumidor final a nombre de ' + (chk.nombre.trim() || 'quien escribas en el paso 1') + '.'; }
  });
  document.addEventListener('focusout', function (e) { var id = e.target.dataset && e.target.dataset.campo; if (id && chk[id] !== '') validar(id); });
  document.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.campo === 'municipio') { chk.municipio = e.target.value; guardarChk(); } });

  /* Valida todos los campos en su lugar (sin redibujar). Devuelve el primer campo con error o null. */
  function validarTodo() {
    var malos = Object.keys(REGLAS).filter(function (id) { return validar(id); });
    if (!malos.length) return null;
    var f = $('#f-' + malos[0]); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); }
    return malos[0];
  }
  function confirmar() {
    if (validarTodo()) { pintarPagar('Revisa los datos marcados en rojo para continuar.'); var f = $('[aria-invalid="true"]'); if (f) f.focus(); return; }
    var c = cuenta();
    for (var i0 = 0; i0 < c.ls.length; i0++) { var x0 = c.ls[i0]; if (esBase(x0.l.sel) && x0.l.q > x0.p.stock) { pintarPagar(x0.p.stock === 0 ? 'Se agotó ' + x0.p.nombre + '. Quítalo del carrito para continuar.' : 'Solo quedan ' + x0.p.stock + ' unidades de ' + x0.p.nombre + '. Ajusta la cantidad en tu carrito.'); return; } }
    if (chk.pago === 'tarjeta') { pagarConTarjeta(c); return; }
    emitir({ pago: chk.pago });
  }
  /* Lo que el servidor necesita: datos del cliente, entrega y productos (los precios los recalcula él). */
  function pedidoBase() {
    return {
      cliente: { nombre: chk.nombre, correo: chk.correo, tel: chk.tel, dui: chk.dui },
      entrega: chk.entrega, municipio: chk.municipio, dir: chk.dir, ref: chk.ref,
      items: lineas().map(function (k) { return { cod: carro[k].cod, sel: carro[k].sel, q: carro[k].q }; })
    };
  }
  function postJSON(url, datos) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'El servidor respondió con un error (' + r.status + ').'); return d; }); });
  }
  function emitir(extra) {
    var c = cuenta(), datos = pedidoBase();
    Object.keys(extra).forEach(function (k) { datos[k] = extra[k]; });
    pasMostrar('<span class="giro" role="progressbar" aria-label="Procesando"></span><h2>Emitiendo tu factura…</h2><p>En unos segundos te la enviamos a ' + esc(chk.correo.trim()) + '.</p>');
    postJSON('/api/pedido', datos).then(function (r) {
      pasCerrar();
      chk.tnum = chk.tnom = chk.texp = chk.tcvv = '';
      ultimaFactura = r.factura; ultimoEmail = r.email || null;
      try { localStorage.setItem('ud-factura', JSON.stringify(r.factura)); localStorage.setItem('ud-email', JSON.stringify(ultimoEmail)); } catch (e) {}
      /* Existencias que devolvió la base de datos; sin base de datos, se descuentan en este navegador. */
      if (r.existencias) aplicarExistencias(r.existencias); else c.ls.forEach(function (x) { if (esBase(x.l.sel)) x.p.stock = Math.max(0, x.p.stock - x.l.q); });
      carro = {}; guardar(); pintarPanel(); pintarTienda();
      navegar('/factura');
    }, function (e) {
      pasCerrar();
      cargarInventario();
      pintarPagar(e.message === 'Failed to fetch' ? 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo; no se emitió ninguna factura.' : e.message);
    });
  }

  /* ---------- PayPal (SDK oficial, entorno Sandbox) ---------- */
  var sdkPayPal = null;
  function cargarPayPal() {
    if (sdkPayPal) return sdkPayPal;
    sdkPayPal = fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
      if (!cfg.paypalClientId) throw new Error('sin-config');
      return new Promise(function (ok, no) {
        var s = document.createElement('script');
        s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(cfg.paypalClientId) + '&currency=USD&intent=capture&enable-funding=card&disable-funding=paylater,venmo&locale=es_XC';
        s.onload = function () { ok(window.paypal); }; s.onerror = function () { no(new Error('carga')); };
        document.head.appendChild(s);
      });
    });
    sdkPayPal.catch(function () { sdkPayPal = null; });
    return sdkPayPal;
  }
  function montarPayPal() {
    var caja = $('#paypal-botones'); if (!caja) return;
    var estado = function (t) { var e = $('#paypal-estado'); if (e) e.textContent = t; };
    caja.innerHTML = '<p class="legal">Cargando PayPal…</p>';
    cargarPayPal().then(function (pp) {
      if (!document.body.contains(caja)) return;
      caja.innerHTML = '';
      pp.Buttons({
        style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay', height: 48 },
        onClick: function (d, actions) {
          if (validarTodo()) { estado('Completa los datos marcados en rojo antes de pagar.'); return actions.reject(); }
          estado(''); return actions.resolve();
        },
        createOrder: function () { return postJSON('/api/paypal/orden', pedidoBase()).then(function (d) { return d.id; }); },
        onApprove: function (data) {
          pasMostrar('<span class="giro" role="progressbar" aria-label="Procesando"></span><h2>Confirmando el pago con PayPal…</h2><p>No cierres esta ventana.</p>');
          return postJSON('/api/paypal/capturar', { orderID: data.orderID }).then(function (d) {
            if (d.status !== 'COMPLETED') throw new Error('PayPal no completó el pago. No se hizo ningún cobro.');
            emitir({ pago: 'paypal', paypal: { orderID: data.orderID } });
          }).catch(function (e) { pasCerrar(); pintarPagar(e.message); });
        },
        onCancel: function () { estado('Cancelaste el pago en PayPal. No se hizo ningún cobro.'); },
        onError: function () { pintarPagar('PayPal no pudo procesar el pago. Inténtalo de nuevo o elige otra forma de pago.'); }
      }).render(caja);
    }, function (e) {
      caja.innerHTML = '';
      estado(e.message === 'sin-config' ? 'PayPal todavía no está configurado: falta PAYPAL_CLIENT_ID en las variables de entorno de Vercel.' : 'No se pudo cargar PayPal. Revisa tu conexión o elige otra forma de pago.');
    });
  }
  /* Pasarela de prueba: procesa, pide el código del banco (3-D Secure) cuando toca, y aprueba o rechaza. */
  var pas = $('#pasarela');
  function pasMostrar(html) { pas.innerHTML = '<div class="pas">' + html + '</div>'; if (!pas.open) { pas.showModal ? pas.showModal() : pas.setAttribute('open', ''); } }
  function pasCerrar() { if (pas.open) pas.close(); }
  pas.addEventListener('cancel', function (e) { e.preventDefault(); });
  function pagarConTarjeta(c) {
    var d = chk.tnum.replace(/\D/g, ''), t = PRUEBA[d];
    var procesando = function (txt) { pasMostrar('<span class="giro" role="progressbar" aria-label="Procesando"></span><h2>' + txt + '</h2><p>No cierres esta ventana.</p>'); };
    var aprobar = function () {
      procesando('Confirmando con tu banco…');
      setTimeout(function () { emitir({ pago: 'tarjeta-prueba', tarjeta: { ult4: d.slice(-4) } }); }, 900);
    };
    procesando('Procesando el pago de ' + money(c.total) + '…');
    setTimeout(function () {
      if (t.res === 'rechazada') { pasCerrar(); pintarPagar('Tu banco rechazó el pago por fondos insuficientes. Prueba con otra tarjeta u otra forma de pago.'); return; }
      if (t.res === '3ds') {
        pasMostrar('<span class="banco">Banco de prueba · Verificación</span><h2>Confirma que eres tú</h2><p>Enviamos un código de 6 dígitos al teléfono registrado en tu tarjeta ' + t.marca + ' terminada en ' + d.slice(-4) + '.<br><b>En modo de prueba el código es 123456.</b></p>' +
          '<label for="otp" hidden>Código de verificación</label><input id="otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><span class="err" id="otp-err" hidden></span>' +
          '<div class="fila-b"><button class="btn sec" type="button" id="otp-no">Cancelar</button><button class="btn" type="button" id="otp-ok">Verificar</button></div>');
        setTimeout(function () { var o = $('#otp'); if (o) o.focus(); }, 50);
        $('#otp-ok').onclick = function () {
          if ($('#otp').value.trim() === '123456') aprobar();
          else { var er = $('#otp-err'); er.textContent = 'El código no coincide. Revisa el mensaje e inténtalo de nuevo.'; er.hidden = false; }
        };
        $('#otp-no').onclick = function () { pasCerrar(); pintarPagar('Cancelaste la verificación del banco. No se hizo ningún cobro.'); };
        return;
      }
      aprobar();
    }, 1400);
  }
  /* Inventario compartido: lo lee del servidor (Supabase) al abrir la tienda y después de cada compra. */
  function aplicarExistencias(ex) {
    var cambio = false;
    P.forEach(function (p) { if (typeof ex[p.cod] === 'number' && ex[p.cod] !== p.stock) { p.stock = Math.max(0, ex[p.cod]); cambio = true; } });
    if (!cambio) return;
    pintarTienda(); pintarPanel();
    if (vistaActual === 'v-producto' && vista.cod) { pintarCompra(); pintarSpecs(); }
  }
  function cargarInventario() {
    fetch('/api/inventario').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.existencias) aplicarExistencias(d.existencias); }, function () {});
  }

  /* ---------- factura de consumidor final ---------- */
  var ultimaFactura = null, ultimoEmail = null;
  try { ultimaFactura = JSON.parse(localStorage.getItem('ud-factura') || 'null'); ultimoEmail = JSON.parse(localStorage.getItem('ud-email') || 'null'); } catch (e) {}
  var enLetras = UF.enLetras, fechaSV = UF.fechaSV, condicion = UF.condicion;
  function pintarFactura() {
    var f = ultimaFactura, el = $('#v-factura');
    if (!f) { el.innerHTML = '<div class="wrap gracias"><h1>Aún no tienes facturas.</h1><p>Cuando confirmes una compra, tu factura aparecerá aquí.</p><a class="btn" href="/">Ir a la tienda</a></div>'; return; }
    var dom = f.entrega === 'domicilio', primer = f.cliente.nombre.split(' ')[0];
    el.innerHTML =
      '<div class="wrap gracias"><span class="ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg></span><h1>¡Gracias, ' + esc(primer) + '! Tu compra está confirmada.</h1>' +
        '<p>' + (dom ? 'Te llevaremos tu pedido a ' + esc(f.municipio) + ' en 24 a 48 horas.' : 'Tu pedido estará listo para recoger en nuestra tienda de San Salvador en 2 horas.') + ' Esta es tu factura de consumidor final.</p></div>' +
      '<div class="wrap fact-lay"><article class="doc" aria-label="Factura de consumidor final">' +
        '<div class="doc-enc"><div class="doc-em"><svg viewBox="0 0 208 241" aria-hidden="true"><use href="#logo"/></svg><div><h2>' + EMPRESA.nombre + '</h2><p>' + EMPRESA.giro + '<br>NIT ' + EMPRESA.nit + ' · NRC ' + EMPRESA.nrc + '<br>' + EMPRESA.dir + '</p></div></div>' +
          '<div class="doc-tipo"><b>Factura consumidor final</b><span>Documento tributario electrónico</span><span>N.º de control: ' + f.control + '</span><span>Código de generación: ' + f.codigo + '</span><span>Fecha y hora: ' + fechaSV(f.fecha) + '</span></div></div>' +
        '<div class="doc-rec"><div><small>Cliente</small><b>' + esc(f.cliente.nombre) + '</b></div><div><small>Correo</small>' + esc(f.cliente.correo) + '</div>' +
          (f.cliente.dui ? '<div><small>DUI</small>' + esc(f.cliente.dui) + '</div>' : '') + (f.cliente.tel ? '<div><small>Teléfono</small>' + esc(f.cliente.tel) + '</div>' : '') +
          '<div><small>Condición de la operación</small>' + esc(condicion(f)) + '</div><div><small>Entrega</small>' + (dom ? esc(f.dir) + ', ' + esc(f.municipio) : 'Recoger en tienda') + '</div></div>' +
        '<table><thead><tr><th>Cant.</th><th>Descripción</th><th class="r">Precio unitario</th><th class="r">Ventas gravadas</th></tr></thead><tbody>' +
          f.items.map(function (it) { return '<tr><td>' + it.q + '</td><td>' + esc(it.desc) + '<small>' + esc(it.cod) + (it.ver ? ' · ' + esc(it.ver) : '') + (it.encargo ? ' · por encargo' : '') + '</small>' + (it.descuento ? '<small class="desc-l">Precio normal ' + money(it.normal) + ' · descuento ' + money(it.descuento) + (it.promo ? ' (' + esc(it.promo) + ')' : '') + '</small>' : '') + '</td><td class="r">' + money(it.pu) + '</td><td class="r">' + money(it.tot) + '</td></tr>'; }).join('') +
        '</tbody></table>' +
        '<div class="doc-pie"><p class="doc-letras">Son:<b>' + enLetras(f.total) + '</b></p><div class="doc-sumas"><div><span>Sumas</span><span>' + money(f.total) + '</span></div><div><span>Ventas exentas</span><span>$0.00</span></div><div><span>Ventas no sujetas</span><span>$0.00</span></div><div class="tot"><span>Total a pagar</span><span>' + money(f.total) + '</span></div><div class="muted"><span>IVA incluido (13 %)</span><span>' + money(f.iva) + '</span></div><div class="muted"><span>Valor sin IVA</span><span>' + money(f.gravadas) + '</span></div></div></div>' +
        '<p class="doc-leg">En la factura de consumidor final los precios incluyen el IVA. Documento de muestra de un proyecto académico: no tiene validez fiscal ante el Ministerio de Hacienda.</p>' +
      '</article>' +
      '<aside class="fact-lado">' +
        (f.paypal ? '<div class="tarj-info"><h3>Pagado con PayPal</h3><p>Transacción ' + esc(f.paypal.captura) + '<br>Entorno Sandbox: no se hizo ningún cobro real.</p></div>' : '') +
        (f.tarjeta ? '<div class="tarj-info"><h3>Pago aprobado</h3><p>' + esc(f.tarjeta.marca) + ' terminada en ' + esc(f.tarjeta.ult4) + ' · Autorización ' + esc(f.tarjeta.aut) + '<br>Modo de prueba: no se hizo ningún cobro real.</p></div>' : '') +
        '<div class="tarj-info" id="caja-pdf"><h3>Tu factura en PDF</h3><p>Descárgala para guardarla o enviarla.</p><button class="btn" type="button" id="bajar-pdf">Descargar PDF</button><p id="pdf-estado" role="status"></p></div>' +
        (ultimoEmail && ultimoEmail.enviado
          ? '<div class="tarj-info"><h3>Enviada a tu correo</h3><p>Mandamos la factura en PDF a <b>' + esc(f.cliente.correo) + '</b>. Si no la ves, revisa la carpeta de spam.</p></div>'
          : '<div class="tarj-info"><h3>No pudimos enviar el correo</h3><p>' + esc((ultimoEmail && ultimoEmail.motivo) || 'El envío por correo no está disponible.') + ' Descarga el PDF para tenerla.</p></div>') +
        (f.pago === 'transferencia' ? '<div class="tarj-info"><h3>Datos para transferir</h3><p>Banco de muestra · Cuenta corriente 000-000000-0<br>A nombre de UNIONDEV, S.A. de C.V.<br>Monto: <b>' + money(f.total) + '</b> · Referencia: ' + f.control.slice(-6) + '</p></div>' : '') +
        '<div class="tarj-info"><h3>¿Qué sigue?</h3><p>' + (dom ? 'Te llamaremos al ' + esc(f.cliente.tel) + ' antes de llegar.' : 'Presenta tu nombre o el número de control al recoger.') + '</p><a class="btn" href="/">Seguir comprando</a></div>' +
      '</aside></div>';
  }

  /* ---------- factura en PDF (mismo diseño que el adjunto del correo) ---------- */
  function bajarPDF() {
    var f = ultimaFactura, est = $('#pdf-estado');
    if (!f || !window.jspdf) { est.textContent = 'No se pudo preparar el PDF. Recarga la página e inténtalo otra vez.'; return; }
    var blob = UF.crearPDF(window.jspdf.jsPDF, f, window.UDLogo).output('blob');
    var url = URL.createObjectURL(blob), enlace = document.createElement('a');
    enlace.href = url; enlace.download = 'Factura-UnionDev-' + f.control.slice(-6) + '.pdf';
    document.body.appendChild(enlace); enlace.click(); document.body.removeChild(enlace);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    est.textContent = 'Listo: revisa tus descargas.';
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.add) {
      var p = by(t.dataset.add), sel = grupos(p).map(function () { return 0; });
      if (agregar(p.cod, sel, 1) && t.classList.contains('mas')) { t.classList.add('ok'); t.innerHTML = CHECK; setTimeout(function () { t.classList.remove('ok'); t.innerHTML = PLUS; }, 1100); }
      return;
    }
    if (t.dataset.catIr) { e.preventDefault(); irCat(t.dataset.catIr); return; }
    if (t.dataset.dir) { var fila = t.closest('section, div').parentNode.querySelector('[data-fila="' + t.parentNode.dataset.flechas + '"]'); if (fila) fila.scrollBy({ left: +t.dataset.dir * fila.clientWidth * .8 }); return; }
    if (t.hasAttribute('data-combo')) { ['MON-001', 'TEC-001', 'MOU-001'].forEach(function (c) { agregar(c, grupos(by(c)).map(function () { return 0; }), 1); }); abrirPanel(); return; }
    if (t.dataset.grupo !== undefined) {
      var gr = grupos(by(vista.cod))[+t.dataset.grupo], op = opcion(gr, +t.dataset.op);
      if (op.ir) { navegar('/producto/' + op.ir); return; }
      vista.sel[+t.dataset.grupo] = +t.dataset.op; vista.cant = 1;
      if (op.gal || gr.color) vista.img = 0;
      pintarGaleria(); pintarCompra(); pintarSpecs(); return;
    }
    if (t.dataset.gal) { var n = galeria(by(vista.cod), vista.sel).length; vista.img = (vista.img + +t.dataset.gal + n) % n; pintarGaleria(); return; }
    if (t.dataset.foto) { vista.img = +t.dataset.foto; pintarGaleria(); return; }
    if (t.dataset.cant) { vista.cant = Math.max(1, vista.cant + +t.dataset.cant); pintarCompra(); return; }
    if (t.id === 'agregar') {
      var pp = by(vista.cod), hechos = agregar(pp.cod, vista.sel, vista.cant);
      if (hechos) { avisar(hechos + ' × ' + pp.nombre + ' agregado al carrito'); vista.cant = 1; pintarCompra(); }
      return;
    }
    if (t.id === 'ver-carro') { $('#toast').hidden = true; abrirPanel(); return; }
    if (t.id === 'abrir-bolsa') { abrirPanel(); return; }
    if (t.hasAttribute('data-cerrar-panel')) { cerrarPanel(); return; }
    if (t.dataset.menos) { var l = carro[t.dataset.menos]; if (l && l.q > 1) l.q--; guardar(); refrescar(l.cod); return; }
    if (t.dataset.mas1) { var l2 = carro[t.dataset.mas1]; if (l2) agregar(l2.cod, l2.sel, 1); return; }
    if (t.dataset.quitar) { var l3 = carro[t.dataset.quitar]; delete carro[t.dataset.quitar]; guardar(); if (l3) refrescar(l3.cod); return; }
    if (t.id === 'pagar') { cerrarPanel(); navegar('/pagar'); return; }
    if (t.dataset.entrega) { chk.entrega = t.dataset.entrega; guardarChk(); pintarPagar(); return; }
    if (t.dataset.metodo) { chk.pago = t.dataset.metodo; guardarChk(); pintarPagar(); return; }
    if (t.id === 'confirmar') { confirmar(); return; }
    if (t.dataset.prueba) { chk.tnum = formatoNum(t.dataset.prueba); if (!chk.tnom) chk.tnom = chk.nombre.trim().toUpperCase(); if (!chk.texp) chk.texp = '08/29'; if (!chk.tcvv) chk.tcvv = '123'; delete errores.tnum; delete errores.tnom; delete errores.texp; delete errores.tcvv; pintarPagar(); return; }
    if (t.id === 'bajar-pdf') { bajarPDF(); return; }
  });
  scrim.addEventListener('click', cerrarPanel);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('abierto')) cerrarPanel();
    if (vista.cod && !panel.classList.contains('abierto') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      var n = galeria(by(vista.cod), vista.sel).length; if (n > 1) { vista.img = (vista.img + (e.key === 'ArrowRight' ? 1 : -1) + n) % n; pintarGaleria(); }
    }
  });
  window.addEventListener('popstate', ruta);

  /* Catálogo vigente desde la base de datos (productos nuevos, precios y fotos del panel). */
  function usarCatalogo(C) {
    UD = C; P = C.P; D = C.D; by = C.by;
    grupos = C.grupos; opcion = C.opcion; esBase = C.esBase; precioDe = C.precioDe; nombreVar = C.nombreVar;
    /* Quita del carrito productos que ya no existen o versiones que cambiaron. */
    Object.keys(carro).forEach(function (k) { var l = carro[k], p = by(l.cod); if (!p || !C.selValida(p, l.sel)) delete carro[k]; });
    guardar(); pintarTienda(); pintarPanel();
    if (/^\/producto\//.test(location.pathname) || vistaActual === 'v-pagar') ruta();
  }
  function cargarCatalogo() {
    fetch('/api/catalogo').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.productos && d.productos.length) usarCatalogo(window.UDDatos.desdeFilas(d.productos, d.promociones || []));
    }, function () {});
  }

  pintarTienda(); pintarPanel(); ruta(); cargarCatalogo();
  (function () {
    var b = $('#inicio');
    b.addEventListener('click', function (e) { var t = e.target.closest('[data-paso],[data-bdir]'); if (!t) return; irSlide(t.dataset.paso != null ? +t.dataset.paso : ban.i + +t.dataset.bdir); });
    b.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; ban.pausa = true; programar(); });
    b.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'mouse') return; ban.pausa = false; irSlide(ban.i); });
    b.addEventListener('focusin', function () { ban.pausa = true; programar(); });
    b.addEventListener('focusout', function (e) { if (!b.contains(e.relatedTarget)) { ban.pausa = false; programar(); } });
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(ban.t); else programar(); });
  })();
  $$('#v-tienda .fila').forEach(function (f) { f.addEventListener('scroll', function () { actFlechas(f); }, { passive: true }); });
  window.addEventListener('resize', function () { $$('.fila').forEach(actFlechas); });
})();
