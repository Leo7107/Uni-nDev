/* Panel de administración UniónDev (navegador). Habla solo con /api/admin; el token de sesión vive en sessionStorage. */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fecha = function (iso, hora) { try { var o = { timeZone: 'America/El_Salvador', day: '2-digit', month: '2-digit', year: 'numeric' }; if (hora) { o.hour = '2-digit'; o.minute = '2-digit'; } return new Date(iso).toLocaleString('es-SV', o); } catch (e) { return iso; } };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var nombreMes = function (ym) { var p = ym.split('-'); return MESES[+p[1] - 1] + ' ' + p[0]; };
  var PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', 'tarjeta-prueba': 'Tarjeta', paypal: 'PayPal' };
  var TIPOS = { entrada: 'Compra', salida: 'Venta', 'ajuste-entrada': 'Ajuste +', 'ajuste-salida': 'Ajuste −', devolucion: 'Devolución', ajuste: 'Ajuste' };
  var mesActual = new Date().toLocaleString('sv-SE', { timeZone: 'America/El_Salvador' }).slice(0, 7);

  /* ---------- sesión ---------- */
  var sesion = null;
  try { sesion = JSON.parse(sessionStorage.getItem('ud-admin') || 'null'); } catch (e) {}
  if (sesion && sesion.expira < Date.now()) sesion = null;

  function api(accion, params, cuerpo) {
    var qs = Object.keys(params || {}).map(function (k) { return '&' + k + '=' + encodeURIComponent(params[k]); }).join('');
    return fetch('/api/admin?a=' + accion + qs, {
      method: cuerpo ? 'POST' : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, sesion ? { Authorization: 'Bearer ' + sesion.token } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && accion !== 'login') { salir('Tu sesión venció. Vuelve a iniciar sesión.'); throw new Error('sesion'); }
        if (!r.ok) throw new Error(d.error || 'No se pudo completar la acción (' + r.status + ').');
        return accion === 'login' ? d : d.datos;
      });
    });
  }
  function salir(msg) {
    sesion = null; try { sessionStorage.removeItem('ud-admin'); } catch (e) {}
    $('#v-panel').hidden = true; $('#v-login').hidden = false;
    var er = $('#l-err'); er.textContent = msg || ''; er.hidden = !msg;
    $('#l-correo').focus();
  }
  $('#form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var correo = $('#l-correo').value.trim(), clave = $('#l-clave').value, er = $('#l-err'), b = $('#l-btn');
    if (!correo || !clave) { er.textContent = 'Escribe tu correo y tu contraseña.'; er.hidden = false; return; }
    b.disabled = true; b.textContent = 'Entrando…'; er.hidden = true;
    api('login', null, { correo: correo, clave: clave }).then(function (d) {
      sesion = d; try { sessionStorage.setItem('ud-admin', JSON.stringify(d)); } catch (e2) {}
      $('#l-clave').value = ''; entrar();
    }, function (err) { er.textContent = err.message; er.hidden = false; }).then(function () { b.disabled = false; b.textContent = 'Iniciar sesión'; });
  });
  $('#salir').addEventListener('click', function () { salir(); });

  /* ---------- navegación ---------- */
  var VISTAS = { resumen: vResumen, inventario: vInventario, ventas: vVentas, libro: vLibro };
  function entrar() { $('#v-login').hidden = true; $('#v-panel').hidden = false; $('#quien').textContent = sesion.correo; ruta(); }
  function ruta() {
    if (!sesion) return;
    var t = (location.hash || '#resumen').slice(1); if (!VISTAS[t]) t = 'resumen';
    Array.prototype.forEach.call(document.querySelectorAll('.tabs a'), function (a) { if (a.dataset.tab === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var c = $('#contenido'); c.innerHTML = '<p class="cargando">Cargando…</p>';
    VISTAS[t](c);
  }
  window.addEventListener('hashchange', ruta);
  function fallo(c) { return function (e) { if (e.message !== 'sesion') c.innerHTML = '<div class="bloque"><p class="err">' + esc(e.message) + '</p><p class="nota">Revisa tu conexión y vuelve a intentarlo.</p></div>'; }; }
  function aviso(t) { var el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(function () { el.hidden = true; }, 3200); }

  /* ---------- resumen ---------- */
  function vResumen(c) {
    api('resumen').then(function (d) {
      var m = d.meses.filter(function (x) { return x.mes === mesActual; })[0] || { facturas: 0, total_con_iva: 0, ventas_netas: 0, iva_debito_fiscal: 0, costo_ventas: 0, utilidad_bruta: 0 };
      c.innerHTML =
        '<div class="cab"><div><h1>Resumen</h1><p>Ventas de ' + nombreMes(mesActual) + ' e inventario actual.</p></div></div>' +
        '<div class="cifras">' +
          cifra('Ventas netas', money(m.ventas_netas), m.facturas + (m.facturas == 1 ? ' factura · ' : ' facturas · ') + money(m.total_con_iva) + ' con IVA') +
          cifra('IVA débito fiscal', money(m.iva_debito_fiscal), '13 % incluido en las ventas') +
          cifra('Costo de ventas', money(m.costo_ventas), 'Al costo del kardex') +
          cifra('Utilidad bruta', money(m.utilidad_bruta), Number(m.ventas_netas) ? 'Margen ' + (100 * m.utilidad_bruta / m.ventas_netas).toFixed(1) + ' %' : 'Sin ventas este mes') +
          cifra('Inventario al costo', money(d.inventario.valor), d.inventario.unidades + ' unidades en ' + d.inventario.productos + ' productos') +
        '</div>' +
        '<div class="dos"><section class="bloque"><h2>Últimas facturas</h2>' + (d.ultimas.length ? '<div class="tabla-caja"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th class="r">Total</th><th>Estado</th></tr></thead><tbody>' +
          d.ultimas.map(function (f) { return '<tr class="clic" data-factura="' + f.id + '"><td class="num">' + pad(f.correlativo) + '</td><td>' + fecha(f.fecha, true) + '</td><td>' + esc(f.cliente_nombre) + '</td><td>' + (PAGOS[f.pago] || f.pago) + '</td><td class="r">' + money(f.ventas_gravadas) + '</td><td>' + estado(f.estado) + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<p class="vacio">Todavía no hay ventas. Aparecerán aquí con la primera compra en la tienda.</p>') + '</section>' +
        '<section class="bloque"><h2>Existencias bajas</h2>' + (d.bajas.length ? d.bajas.map(function (p) { return '<div class="alerta"><span>' + esc(p.descripcion.split(',')[0]) + ' <small style="color:var(--muted)">' + p.cod + '</small></span><b>' + (p.existencia === 0 ? 'Agotado' : p.existencia + ' u.') + '</b></div>'; }).join('') + '<p class="nota">Registra una compra desde Inventario para reponer.</p>' : '<p class="vacio">Todos los productos tienen 2 unidades o más.</p>') + '</section></div>' +
        (d.meses.length ? '<section class="bloque" style="margin-top:20px"><h2>Ventas por mes</h2><div class="tabla-caja"><table><thead><tr><th>Mes</th><th class="r">Facturas</th><th class="r">Total con IVA</th><th class="r">Ventas netas</th><th class="r">IVA débito</th><th class="r">Costo de ventas</th><th class="r">Utilidad bruta</th></tr></thead><tbody>' +
          d.meses.map(function (x) { return '<tr><td>' + nombreMes(x.mes) + '</td><td class="r">' + x.facturas + '</td><td class="r">' + money(x.total_con_iva) + '</td><td class="r">' + money(x.ventas_netas) + '</td><td class="r">' + money(x.iva_debito_fiscal) + '</td><td class="r">' + money(x.costo_ventas) + '</td><td class="r">' + money(x.utilidad_bruta) + '</td></tr>'; }).join('') + '</tbody></table></div></section>' : '');
    }, fallo(c));
  }
  function cifra(t, v, s) { return '<div class="cifra"><small>' + t + '</small><b>' + v + '</b><span>' + esc(s) + '</span></div>'; }
  function pad(n) { return String(n).padStart(6, '0'); }
  function estado(e) { return e === 'anulada' ? '<span class="estado mal">Anulada</span>' : '<span class="estado ok">Emitida</span>'; }

  /* ---------- inventario ---------- */
  var inv = [];
  function vInventario(c) {
    api('inventario').then(function (d) {
      inv = d;
      c.innerHTML = '<div class="cab"><div><h1>Inventario</h1><p>Existencias y costo promedio ponderado. Las compras actualizan el costo; los ajustes requieren motivo.</p></div>' +
        '<div class="herr"><label for="buscar" hidden>Buscar</label><input id="buscar" type="search" placeholder="Buscar producto o código" autocomplete="off"></div></div>' +
        '<div class="tabla-caja"><table><thead><tr><th>Código</th><th>Producto</th><th class="r">Existencia</th><th class="r">Costo unit.</th><th class="r">Valor al costo</th><th class="r">Precio (IVA incl.)</th><th class="r">Margen</th><th class="r">Acciones</th></tr></thead><tbody id="inv-filas"></tbody><tfoot id="inv-pie"></tfoot></table></div>' +
        '<p class="nota">Margen = (precio sin IVA − costo) ÷ precio sin IVA.</p>';
      pintarInv('');
      $('#buscar').addEventListener('input', function () { pintarInv(this.value); });
    }, fallo(c));
  }
  function pintarInv(q) {
    q = q.trim().toLowerCase();
    var filas = inv.filter(function (p) { return !q || (p.cod + ' ' + p.descripcion + ' ' + p.marca + ' ' + p.categoria).toLowerCase().indexOf(q) >= 0; });
    $('#inv-filas').innerHTML = filas.map(function (p) {
      var sinIva = p.precio / 1.13, margen = sinIva ? (sinIva - p.costo_unitario) / sinIva * 100 : 0;
      return '<tr><td class="num">' + p.cod + '</td><td class="desc">' + esc(p.descripcion) + '<small>' + esc(p.marca) + ' · ' + esc(p.categoria) + '</small></td>' +
        '<td class="r">' + (p.existencia <= 1 ? '<span class="estado ' + (p.existencia === 0 ? 'mal' : 'bajo') + '">' + p.existencia + '</span>' : p.existencia) + '</td>' +
        '<td class="r">' + money(p.costo_unitario) + '</td><td class="r">' + money(p.valor_al_costo) + '</td><td class="r">' + money(p.precio) + '</td><td class="r">' + margen.toFixed(1) + ' %</td>' +
        '<td><div class="acciones"><button class="btn sec chico" type="button" data-kardex="' + p.cod + '">Kardex</button><button class="btn sec chico" type="button" data-compra="' + p.cod + '">Compra</button><button class="btn sec chico" type="button" data-ajuste="' + p.cod + '">Ajuste</button></div></td></tr>';
    }).join('') || '<tr><td colspan="8" class="vacio">Ningún producto coincide con la búsqueda.</td></tr>';
    var u = filas.reduce(function (a, p) { return a + p.existencia; }, 0), v = filas.reduce(function (a, p) { return a + Number(p.valor_al_costo); }, 0);
    $('#inv-pie').innerHTML = '<tr><td colspan="2">Total' + (q ? ' (filtrado)' : '') + '</td><td class="r">' + u + '</td><td></td><td class="r">' + money(v) + '</td><td colspan="3"></td></tr>';
  }
  function prod(cod) { return inv.filter(function (p) { return p.cod === cod; })[0]; }

  /* ---------- diálogos ---------- */
  var dlg = $('#dlg');
  function abrir(html, ancho) { dlg.className = 'dlg' + (ancho ? ' ancho' : ''); dlg.innerHTML = '<div class="dlg-in">' + html + '</div>'; dlg.showModal(); var f = dlg.querySelector('input'); if (f) f.focus(); }
  function cerrar() { dlg.close(); }
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-cerrar]')) cerrar(); });
  function cab(t, s) { return '<div class="dlg-cab"><div><h2 id="dlg-t">' + t + '</h2>' + (s ? '<p>' + s + '</p>' : '') + '</div><button class="x" type="button" data-cerrar aria-label="Cerrar">×</button></div>'; }

  function dKardex(cod) {
    var p = prod(cod);
    abrir(cab('Kardex · ' + esc(cod), esc(p.descripcion)) + '<p class="cargando">Cargando movimientos…</p>', true);
    api('kardex', { cod: cod }).then(function (movs) {
      dlg.querySelector('.cargando').outerHTML = '<div class="tabla-caja" style="max-height:60vh"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Referencia</th><th class="r">Entra</th><th class="r">Sale</th><th class="r">Costo unit.</th><th class="r">Costo total</th><th class="r">Saldo</th></tr></thead><tbody>' +
        movs.map(function (m) {
          var entra = /entrada|devolucion/.test(m.tipo);
          return '<tr><td>' + fecha(m.fecha, true) + '</td><td>' + (TIPOS[m.tipo] || m.tipo) + '</td><td class="desc">' + esc(m.referencia) + '</td><td class="r">' + (entra ? m.cantidad : '') + '</td><td class="r">' + (entra ? '' : m.cantidad) + '</td><td class="r">' + money(m.costo_unitario) + '</td><td class="r">' + money(m.costo_total) + '</td><td class="r">' + m.existencia_resultante + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="nota">Existencia actual: ' + p.existencia + ' u. · Costo promedio: ' + money(p.costo_unitario) + '</p>';
    }, function (e) { if (e.message !== 'sesion') dlg.querySelector('.cargando').outerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
  }
  function dCompra(cod) {
    var p = prod(cod);
    abrir(cab('Registrar compra', esc(cod) + ' · ' + esc(p.descripcion)) +
      '<form id="f-compra" class="campos" novalidate><div class="campo"><label for="c-cant">Cantidad</label><input id="c-cant" type="number" min="1" step="1" inputmode="numeric" required></div>' +
      '<div class="campo"><label for="c-costo">Costo unitario sin IVA</label><input id="c-costo" type="number" min="0" step="0.01" inputmode="decimal" value="' + Number(p.costo_unitario).toFixed(2) + '" required></div>' +
      '<div class="campo full"><label for="c-ref">Referencia <span style="font-weight:400;color:var(--muted)">(opcional)</span></label><input id="c-ref" type="text" placeholder="Proveedor y n.º de comprobante de crédito fiscal" maxlength="120"></div>' +
      '<div class="vista-previa campo full" id="c-prev"></div><p class="err campo full" id="c-err" hidden></p>' +
      '<div class="dlg-pie campo full"><button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn" type="submit">Registrar compra</button></div></form>');
    var prev = function () {
      var q = parseInt($('#c-cant').value, 10) || 0, cu = Number($('#c-costo').value) || 0;
      var nuevo = (p.existencia + q) ? (p.existencia * p.costo_unitario + q * cu) / (p.existencia + q) : cu;
      $('#c-prev').innerHTML = '<div><span>Existencia</span><b>' + p.existencia + ' → ' + (p.existencia + q) + '</b></div><div><span>Costo promedio</span><b>' + money(p.costo_unitario) + ' → ' + money(nuevo) + '</b></div><div><span>Total de la compra sin IVA</span><b>' + money(q * cu) + '</b></div><div><span>IVA crédito fiscal (13 %)</span><b>' + money(q * cu * 0.13) + '</b></div>';
    };
    prev(); dlg.addEventListener('input', prev);
    $('#f-compra').addEventListener('submit', function (e) {
      e.preventDefault(); var er = $('#c-err'), q = parseInt($('#c-cant').value, 10), cu = Number($('#c-costo').value);
      if (!(q > 0)) { er.textContent = 'La cantidad debe ser un número entero mayor que cero.'; er.hidden = false; return; }
      if (!(cu >= 0) || $('#c-costo').value === '') { er.textContent = 'Escribe el costo unitario sin IVA.'; er.hidden = false; return; }
      enviarForm(this, api('compra', null, { cod: cod, cantidad: q, costo: cu, referencia: $('#c-ref').value.trim() }), 'Compra registrada: ' + q + ' u. de ' + cod);
    });
  }
  function dAjuste(cod) {
    var p = prod(cod);
    abrir(cab('Ajuste de inventario', esc(cod) + ' · existencia actual ' + p.existencia + ' u.') +
      '<form id="f-ajuste" class="campos" novalidate><div class="campo"><label for="a-dir">Tipo</label><select id="a-dir"><option value="-1">Salida (daño, pérdida, faltante)</option><option value="1">Entrada (sobrante en conteo)</option></select></div>' +
      '<div class="campo"><label for="a-cant">Cantidad</label><input id="a-cant" type="number" min="1" step="1" inputmode="numeric" required></div>' +
      '<div class="campo full"><label for="a-mot">Motivo</label><input id="a-mot" type="text" placeholder="Ej.: unidad dañada en exhibición" maxlength="120" required></div>' +
      '<p class="nota campo full">El ajuste se valora al costo promedio actual (' + money(p.costo_unitario) + ') y queda en el kardex.</p><p class="err campo full" id="a-err" hidden></p>' +
      '<div class="dlg-pie campo full"><button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn" type="submit">Registrar ajuste</button></div></form>');
    $('#f-ajuste').addEventListener('submit', function (e) {
      e.preventDefault(); var er = $('#a-err'), q = parseInt($('#a-cant').value, 10), mot = $('#a-mot').value.trim();
      if (!(q > 0)) { er.textContent = 'La cantidad debe ser un número entero mayor que cero.'; er.hidden = false; return; }
      if (!mot) { er.textContent = 'Escribe el motivo del ajuste.'; er.hidden = false; return; }
      enviarForm(this, api('ajuste', null, { cod: cod, cantidad: q * Number($('#a-dir').value), motivo: mot }), 'Ajuste registrado en ' + cod);
    });
  }
  function enviarForm(form, promesa, ok) {
    var b = form.querySelector('[type=submit]'), er = form.querySelector('.err'); b.disabled = true; er.hidden = true;
    promesa.then(function () { cerrar(); aviso(ok); ruta(); }, function (e) { if (e.message === 'sesion') return; er.textContent = e.message; er.hidden = false; b.disabled = false; });
  }

  /* ---------- ventas ---------- */
  function vVentas(c, mes) {
    mes = mes || $('#v-mes') && $('#v-mes').value || mesActual;
    api('facturas', { mes: mes }).then(function (fs) {
      var em = fs.filter(function (f) { return f.estado === 'emitida'; });
      var s = function (k) { return em.reduce(function (a, f) { return a + Number(f[k]); }, 0); };
      c.innerHTML = '<div class="cab"><div><h1>Ventas</h1><p>Facturas de consumidor final emitidas por la tienda.</p></div><div class="herr"><label for="v-mes">Mes</label><input id="v-mes" type="month" value="' + mes + '"></div></div>' +
        (fs.length ? '<div class="tabla-caja"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th class="r">Ventas netas</th><th class="r">IVA</th><th class="r">Total</th><th class="r">Costo</th><th>Correo</th><th>Estado</th></tr></thead><tbody>' +
          fs.map(function (f) { return '<tr class="clic" data-factura="' + f.id + '"><td class="num">' + pad(f.correlativo) + '</td><td>' + fecha(f.fecha, true) + '</td><td>' + esc(f.cliente_nombre) + '<small>' + esc(f.cliente_correo) + '</small></td><td>' + (PAGOS[f.pago] || f.pago) + '</td><td class="r">' + money(f.ventas_netas) + '</td><td class="r">' + money(f.iva_debito) + '</td><td class="r">' + money(f.ventas_gravadas) + '</td><td class="r">' + money(f.costo_ventas) + '</td><td>' + (f.correo_enviado ? 'Enviado' : '<span style="color:var(--muted)">No</span>') + '</td><td>' + estado(f.estado) + '</td></tr>'; }).join('') +
          '</tbody><tfoot><tr><td colspan="4">Total emitidas (' + em.length + ')</td><td class="r">' + money(s('ventas_netas')) + '</td><td class="r">' + money(s('iva_debito')) + '</td><td class="r">' + money(s('ventas_gravadas')) + '</td><td class="r">' + money(s('costo_ventas')) + '</td><td colspan="2"></td></tr></tfoot></table></div><p class="nota">Las facturas anuladas no suman en los totales. Toca una factura para ver el detalle.</p>'
          : '<div class="bloque"><p class="vacio">No hay facturas en ' + nombreMes(mes) + '.</p></div>');
      $('#v-mes').addEventListener('change', function () { if (this.value) vVentas(c, this.value); });
    }, fallo(c));
  }
  function dFactura(id) {
    abrir(cab('Factura', '') + '<p class="cargando">Cargando…</p>', true);
    api('factura', { id: id }).then(function (f) {
      var pago = f.pago_detalle && f.pago_detalle.ult4 ? 'Tarjeta ' + f.pago_detalle.marca + ' •••• ' + f.pago_detalle.ult4 + ' · Aut. ' + f.pago_detalle.aut : f.pago_detalle && f.pago_detalle.captura ? 'PayPal · ' + f.pago_detalle.captura : (PAGOS[f.pago] || f.pago);
      dlg.querySelector('.dlg-in').innerHTML = cab('Factura ' + pad(f.correlativo) + ' ' + estado(f.estado), esc(f.control) + ' · ' + fecha(f.fecha, true)) +
        '<div class="vista-previa"><div><span>Cliente</span><b>' + esc(f.cliente_nombre) + '</b></div><div><span>Correo</span><b>' + esc(f.cliente_correo) + '</b></div><div><span>Pago</span><b>' + esc(pago) + '</b></div><div><span>Entrega</span><b>' + (f.entrega === 'domicilio' ? esc(f.direccion + ', ' + f.municipio) : 'Recoger en tienda') + '</b></div>' + (f.estado === 'anulada' ? '<div><span>Anulada</span><b>' + fecha(f.anulada_fecha, true) + ' · ' + esc(f.anulada_motivo) + '</b></div>' : '') + '</div>' +
        '<div class="tabla-caja"><table><thead><tr><th class="r">Cant.</th><th>Descripción</th><th class="r">Precio unit.</th><th class="r">Total</th><th class="r">Sin IVA</th><th class="r">IVA</th><th class="r">Costo</th></tr></thead><tbody>' +
        f.detalle.map(function (d) { return '<tr><td class="r">' + d.cantidad + '</td><td class="desc">' + esc(d.descripcion) + '<small>' + esc(d.cod) + (d.version ? ' · ' + esc(d.version) : '') + (d.por_encargo ? ' · por encargo' : '') + '</small></td><td class="r">' + money(d.precio_unitario) + '</td><td class="r">' + money(d.total) + '</td><td class="r">' + money(d.ventas_netas) + '</td><td class="r">' + money(d.iva) + '</td><td class="r">' + money(d.costo_total) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td colspan="3">Totales</td><td class="r">' + money(f.ventas_gravadas) + '</td><td class="r">' + money(f.ventas_netas) + '</td><td class="r">' + money(f.iva_debito) + '</td><td class="r">' + money(f.costo_ventas) + '</td></tr></tfoot></table></div>' +
        (f.estado === 'emitida' ? '<form id="f-anular" class="campos" novalidate><div class="campo full"><label for="an-mot">Anular esta factura</label><input id="an-mot" type="text" placeholder="Motivo de la anulación" maxlength="160"></div><p class="nota campo full">Al anularla, las unidades vuelven al inventario y la venta deja de sumar en el libro de ventas.</p><p class="err campo full" hidden></p><div class="dlg-pie campo full"><button class="btn sec" type="button" data-cerrar>Cerrar</button><button class="btn peligro" type="submit">Anular factura ' + pad(f.correlativo) + '</button></div></form>' : '<div class="dlg-pie"><button class="btn sec" type="button" data-cerrar>Cerrar</button></div>');
      var fa = $('#f-anular');
      if (fa) fa.addEventListener('submit', function (e) {
        e.preventDefault(); var mot = $('#an-mot').value.trim(), er = fa.querySelector('.err');
        if (!mot) { er.textContent = 'Escribe el motivo de la anulación.'; er.hidden = false; return; }
        enviarForm(fa, api('anular', null, { id: f.id, motivo: mot }), 'Factura ' + pad(f.correlativo) + ' anulada');
      });
    }, function (e) { if (e.message !== 'sesion') dlg.querySelector('.cargando').outerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
  }

  /* ---------- libro de ventas a consumidor final ---------- */
  function vLibro(c, mes) {
    mes = mes || mesActual;
    api('libro', { mes: mes }).then(function (dias) {
      var s = function (k) { return dias.reduce(function (a, d) { return a + Number(d[k]); }, 0); };
      c.innerHTML = '<div class="cab"><div><h1>Libro de ventas a consumidor final</h1><p>UNIONDEV, S.A. de C.V. · NRC 312045-7 · ' + nombreMes(mes) + '</p></div><div class="herr"><label for="l-mes">Mes</label><input id="l-mes" type="month" value="' + mes + '"></div></div>' +
        (dias.length ? '<div class="tabla-caja"><table><thead><tr><th>Día</th><th>Del n.º</th><th>Al n.º</th><th class="r">Documentos</th><th class="r">Ventas exentas</th><th class="r">Ventas no sujetas</th><th class="r">Ventas gravadas</th><th class="r">Total ventas diarias</th></tr></thead><tbody>' +
          dias.map(function (d) { return '<tr><td>' + fecha(d.dia + 'T12:00:00-06:00') + '</td><td class="num">' + d.del_numero + '</td><td class="num">' + d.al_numero + '</td><td class="r">' + d.documentos + '</td><td class="r">' + money(d.ventas_exentas) + '</td><td class="r">' + money(d.ventas_no_sujetas) + '</td><td class="r">' + money(d.ventas_gravadas) + '</td><td class="r">' + money(d.total_ventas_diarias) + '</td></tr>'; }).join('') +
          '</tbody><tfoot><tr><td colspan="3">Total del mes</td><td class="r">' + s('documentos') + '</td><td class="r">$0.00</td><td class="r">$0.00</td><td class="r">' + money(s('ventas_gravadas')) + '</td><td class="r">' + money(s('total_ventas_diarias')) + '</td></tr></tfoot></table></div>' +
          '<div class="cifras" style="margin-top:18px">' + cifra('Ventas gravadas con IVA', money(s('ventas_gravadas')), 'Total del mes') + cifra('Ventas netas (sin IVA)', money(s('ventas_netas')), 'Ventas gravadas ÷ 1.13') + cifra('IVA débito fiscal', money(s('iva_debito_fiscal')), 'Para la declaración de IVA (F-07)') + '</div>' +
          '<p class="nota">Solo incluye facturas emitidas; las anuladas no suman. En la factura de consumidor final el IVA va incluido en el precio.</p>'
          : '<div class="bloque"><p class="vacio">No hay ventas registradas en ' + nombreMes(mes) + '.</p></div>');
      $('#l-mes').addEventListener('change', function () { if (this.value) vLibro(c, this.value); });
    }, fallo(c));
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-kardex],[data-compra],[data-ajuste],[data-factura]'); if (!t) return;
    if (t.dataset.kardex) dKardex(t.dataset.kardex);
    else if (t.dataset.compra) dCompra(t.dataset.compra);
    else if (t.dataset.ajuste) dAjuste(t.dataset.ajuste);
    else if (t.dataset.factura) dFactura(+t.dataset.factura);
  });

  if (sesion) entrar(); else salir();
})();
