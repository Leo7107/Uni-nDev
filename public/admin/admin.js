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
  var VISTAS = { resumen: vResumen, productos: vProductos, inventario: vInventario, ventas: vVentas, libro: vLibro };
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

  /* ---------- productos ---------- */
  var CATEGORIAS = ['Laptops', 'Tablets', 'Monitores', 'Teclados', 'Mouse', 'Audio y video', 'Impresoras', 'Almacenamiento', 'Componentes', 'Redes', 'Energía'];
  var prods = [], ed = null;
  function vProductos(c) {
    api('productos').then(function (d) {
      prods = d;
      c.innerHTML = '<div class="cab"><div><h1>Productos</h1><p>Lo que ves aquí es lo que muestra la tienda. Los cambios se publican en segundos.</p></div>' +
        '<div class="herr"><label for="p-buscar" hidden>Buscar</label><input id="p-buscar" type="search" placeholder="Buscar producto o código" autocomplete="off"><button class="btn" type="button" id="p-nuevo">Nuevo producto</button></div></div>' +
        '<div class="tabla-caja"><table><thead><tr><th></th><th>Código</th><th>Producto</th><th>Categoría</th><th class="r">Precio</th><th class="r">Existencia</th><th>En la tienda</th><th class="r"></th></tr></thead><tbody id="p-filas"></tbody></table></div>' +
        '<p class="nota">Ocultar un producto lo quita de la tienda sin borrar sus ventas ni su historial. Para cambiar existencias o costos usa Inventario (compras y ajustes).</p>';
      pintarProds('');
      $('#p-buscar').addEventListener('input', function () { pintarProds(this.value); });
      $('#p-nuevo').addEventListener('click', function () { abrirEditor(null); });
    }, fallo(c));
  }
  function pintarProds(q) {
    q = q.trim().toLowerCase();
    var f = prods.filter(function (p) { return !q || (p.cod + ' ' + p.nombre + ' ' + p.marca + ' ' + p.categoria).toLowerCase().indexOf(q) >= 0; });
    $('#p-filas').innerHTML = f.map(function (p) {
      var foto = p.galeria && p.galeria[0];
      return '<tr class="clic" data-editar="' + p.cod + '"><td>' + (foto ? '<img class="mini-foto" src="' + esc(foto) + '" alt="" loading="lazy">' : '<span class="mini-foto vacia">Sin foto</span>') + '</td><td class="num">' + p.cod + '</td><td class="desc">' + esc(p.nombre || p.descripcion) + '<small>' + esc(p.marca) + (p.versiones && p.versiones.length ? ' · ' + p.versiones.map(function (v) { return v.t; }).join(', ') : '') + '</small></td><td>' + esc(p.categoria) + '</td><td class="r">' + money(p.precio) + '</td><td class="r">' + p.existencia + '</td><td>' + (p.activo === false ? '<span class="estado mal">Oculto</span>' : '<span class="estado ok">Visible</span>') + '</td><td><div class="acciones"><button class="btn sec chico" type="button" data-editar="' + p.cod + '">Editar</button></div></td></tr>';
    }).join('') || '<tr><td colspan="8" class="vacio">Ningún producto coincide con la búsqueda.</td></tr>';
  }
  function siguienteCodigo(cat) {
    var pref = { 'Laptops': 'LAP', 'Tablets': 'TAB', 'Monitores': 'MON', 'Teclados': 'TEC', 'Mouse': 'MOU', 'Audio y video': 'AUD', 'Impresoras': 'IMP', 'Almacenamiento': 'ALM', 'Componentes': 'COM', 'Redes': 'RED', 'Energía': 'ENE' }[cat] || 'PRD';
    var n = prods.filter(function (p) { return p.cod.indexOf(pref + '-') === 0; }).reduce(function (m, p) { return Math.max(m, +p.cod.slice(4)); }, 0);
    return pref + '-' + String(n + 1).padStart(3, '0');
  }
  function abrirEditor(cod) {
    var p = cod ? prods.filter(function (x) { return x.cod === cod; })[0] : null;
    ed = p ? {
      nuevo: false, cod: p.cod, nombre: p.nombre || p.descripcion, categoria: p.categoria, marca: p.marca, specs_corto: p.specs_corto || '', resumen: p.resumen || '',
      descripcion_larga: p.descripcion_larga || '', precio: Number(p.precio).toFixed(2), activo: p.activo !== false, existencia: p.existencia, costo_unitario: p.costo_unitario,
      puntos: JSON.parse(JSON.stringify(p.puntos || [])), especificaciones: JSON.parse(JSON.stringify(p.especificaciones || [])),
      galeria: (p.galeria || []).slice(), versiones: JSON.parse(JSON.stringify(p.versiones || []))
    } : { nuevo: true, cod: siguienteCodigo('Laptops'), nombre: '', categoria: 'Laptops', marca: '', specs_corto: '', resumen: '', descripcion_larga: '', precio: '', activo: true, existencia: '0', costo_unitario: '', puntos: [['', ''], ['', ''], ['', '']], especificaciones: [['', '']], galeria: [], versiones: [] };
    while (ed.puntos.length < 3) ed.puntos.push(['', '']);
    dlg.className = 'dlg editor'; pintarEditor(); dlg.showModal();
    var f = dlg.querySelector('#e-nombre'); if (f) f.focus();
  }
  function campoE(id, label, valor, extra) { return '<div class="campo' + (extra && extra.full ? ' full' : '') + '"><label for="e-' + id + '">' + label + '</label><input id="e-' + id + '" data-e="' + id + '" value="' + esc(valor) + '"' + (extra && extra.attrs ? ' ' + extra.attrs : '') + '>' + (extra && extra.calc ? '<span class="calc" id="calc-' + id + '">' + extra.calc + '</span>' : '') + '</div>'; }
  function calcPrecio() { var v = Number(ed.precio) || 0; return v ? 'Sin IVA ' + money(v / 1.13) + ' · IVA ' + money(v - v / 1.13) : 'Precio final al consumidor, con IVA incluido.'; }
  function pintarEditor() {
    var e = ed;
    dlg.innerHTML = '<div class="dlg-in">' + cab(e.nuevo ? 'Nuevo producto' : 'Editar ' + esc(e.cod), e.nuevo ? 'Completa la ficha; podrás editarla cuando quieras.' : esc(e.nombre)) +
      '<section class="ed-sec" style="border-top:0;padding-top:0"><h3>Datos</h3><div class="campos tres">' +
        (e.nuevo ? campoE('cod', 'Código', e.cod, { attrs: 'maxlength="7" style="text-transform:uppercase"' }) : '<div class="campo"><label>Código</label><input value="' + esc(e.cod) + '" disabled></div>') +
        '<div class="campo"><label for="e-categoria">Categoría</label><select id="e-categoria" data-e="categoria">' + CATEGORIAS.map(function (c) { return '<option' + (c === e.categoria ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
        campoE('marca', 'Marca', e.marca, { attrs: 'maxlength="60"' }) +
        campoE('nombre', 'Nombre en la tienda', e.nombre, { full: true, attrs: 'maxlength="120" placeholder="Ej.: Laptop Lenovo IdeaPad Slim 3"' }) +
        campoE('specs_corto', 'Línea corta bajo el nombre', e.specs_corto, { full: true, attrs: 'maxlength="160" placeholder="Ej.: Core i5 · 16 GB RAM · 512 GB SSD"' }) +
        campoE('precio', 'Precio con IVA ($)', e.precio, { attrs: 'type="number" min="0.01" step="0.01" inputmode="decimal"', calc: calcPrecio() }) +
        (e.nuevo ? campoE('existencia', 'Existencia inicial', e.existencia, { attrs: 'type="number" min="0" step="1" inputmode="numeric"' }) + campoE('costo_unitario', 'Costo unitario sin IVA ($)', e.costo_unitario, { attrs: 'type="number" min="0" step="0.01" inputmode="decimal"' })
          : '<div class="campo"><label>Existencia</label><input value="' + e.existencia + '" disabled><span class="calc">Se cambia con compras y ajustes en Inventario.</span></div><div class="campo"><label>Costo promedio</label><input value="' + money(e.costo_unitario) + '" disabled></div>') +
      '</div><label class="check"><input type="checkbox" id="e-activo" data-e="activo"' + (e.activo ? ' checked' : '') + '> Visible en la tienda</label></section>' +
      '<section class="ed-sec"><h3>Fotos</h3><p class="ayuda">La primera es la principal (tarjeta y portada). Se recomiendan fotos con fondo blanco.</p><div class="fotos" id="e-fotos"></div><input type="file" id="e-archivo" accept="image/png,image/jpeg,image/webp" multiple hidden><p class="err" id="e-foto-err" hidden></p></section>' +
      '<section class="ed-sec"><h3>Descripción</h3><div class="campos">' + campoE('resumen', 'Frase destacada', e.resumen, { full: true, attrs: 'maxlength="240" placeholder="Ej.: La opción más accesible para estudiar y trabajar."' }) +
        '<div class="campo full"><label for="e-descripcion_larga">Descripción</label><textarea id="e-descripcion_larga" data-e="descripcion_larga" maxlength="3000">' + esc(e.descripcion_larga) + '</textarea></div></div></section>' +
      '<section class="ed-sec"><h3>Puntos destacados</h3><p class="ayuda">Se muestran como tres tarjetas debajo de la descripción.</p><div class="filas">' + e.puntos.map(function (x, i) { return '<div class="fila"><input data-punto="' + i + '" data-k="0" value="' + esc(x[0]) + '" placeholder="Título" maxlength="80" aria-label="Título del punto ' + (i + 1) + '"><input data-punto="' + i + '" data-k="1" value="' + esc(x[1]) + '" placeholder="Texto" maxlength="300" aria-label="Texto del punto ' + (i + 1) + '"><span></span></div>'; }).join('') + '</div></section>' +
      '<section class="ed-sec"><h3>Especificaciones</h3><div class="filas">' + e.especificaciones.map(function (x, i) { return '<div class="fila"><input data-spec="' + i + '" data-k="0" value="' + esc(x[0]) + '" placeholder="Ej.: Procesador" maxlength="60" aria-label="Nombre"><input data-spec="' + i + '" data-k="1" value="' + esc(x[1]) + '" placeholder="Ej.: Intel Core i5" maxlength="200" aria-label="Valor"><button class="quitar" type="button" data-quitar-spec="' + i + '" aria-label="Quitar especificación">×</button></div>'; }).join('') + '</div><button class="btn enlace" type="button" id="e-mas-spec">+ Agregar especificación</button></section>' +
      '<section class="ed-sec"><h3>Versiones</h3><p class="ayuda">Colores, almacenamiento, memoria… La primera opción de cada grupo es la versión en existencia; las demás se venden por encargo con su diferencia de precio (con IVA).</p><div class="filas" id="e-versiones">' + e.versiones.map(pintarGrupo).join('') + '</div><button class="btn enlace" type="button" id="e-mas-grupo">+ Agregar grupo de versiones</button></section>' +
      '<p class="err" id="e-err" role="alert" hidden></p>' +
      '<div class="dlg-pie pie-fijo"><button class="btn sec" type="button" data-cerrar>Cancelar</button><button class="btn" type="button" id="e-guardar">' + (e.nuevo ? 'Crear producto' : 'Guardar cambios') + '</button></div></div>';
    pintarFotos();
  }
  function pintarGrupo(g, gi) {
    return '<div class="grupo-v"><div class="cab-v"><input data-grupo="' + gi + '" value="' + esc(g.t) + '" placeholder="Nombre del grupo (ej.: Color, Almacenamiento)" maxlength="40" aria-label="Nombre del grupo">' +
      '<label class="check"><input type="checkbox" data-grupo-color="' + gi + '"' + (g.color ? ' checked' : '') + '> Son colores</label><button class="quitar" type="button" data-quitar-grupo="' + gi + '" aria-label="Quitar grupo">×</button></div>' +
      g.ops.map(function (o, oi) {
        return '<div class="op"><input data-op="' + gi + '-' + oi + '" data-k="0" value="' + esc(o[0]) + '" placeholder="' + (g.color ? 'Ej.: Azul' : 'Ej.: 1 TB SSD') + '" maxlength="60" aria-label="Nombre de la opción">' +
          (o[4] ? '<span class="calc">Lleva a ' + esc(o[4]) + '</span>' : oi === 0 ? '<span class="base">Versión en existencia</span>' : '<input data-op="' + gi + '-' + oi + '" data-k="1" type="number" step="0.01" value="' + esc(o[1] || 0) + '" placeholder="Diferencia $" aria-label="Diferencia de precio">') +
          (g.color ? '<input type="color" data-op="' + gi + '-' + oi + '" data-k="2" value="' + esc(o[2] || '#cccccc') + '" aria-label="Color">' : '<span></span>') +
          (g.ops.length > 2 ? '<button class="quitar" type="button" data-quitar-op="' + gi + '-' + oi + '" aria-label="Quitar opción">×</button>' : '<span></span>') + '</div>';
      }).join('') + '<button class="btn enlace" type="button" data-mas-op="' + gi + '">+ Agregar opción</button></div>';
  }
  function pintarFotos() {
    $('#e-fotos').innerHTML = ed.galeria.map(function (u, i) {
      return '<div class="foto"><img src="' + esc(u) + '" alt="Foto ' + (i + 1) + '">' + (i === 0 ? '<span class="principal">Principal</span>' : '') +
        '<div class="ctl">' + (i > 0 ? '<button type="button" data-foto-izq="' + i + '" aria-label="Mover a la izquierda">←</button>' : '') + (i < ed.galeria.length - 1 ? '<button type="button" data-foto-der="' + i + '" aria-label="Mover a la derecha">→</button>' : '') + '<button type="button" data-foto-quitar="' + i + '" aria-label="Quitar foto">×</button></div></div>';
    }).join('') + (ed.galeria.length < 12 ? '<button class="subir" type="button" id="e-subir">+ Subir fotos</button>' : '');
  }
  /* Reduce la foto a 1400 px como máximo y la convierte a WEBP antes de subirla. */
  function prepararFoto(file) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1400 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          if (!b) return no(new Error('No se pudo procesar la foto.'));
          var r = new FileReader(); r.onload = function () { ok(r.result.split(',')[1]); }; r.onerror = function () { no(new Error('No se pudo leer la foto.')); }; r.readAsDataURL(b);
        }, 'image/webp', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('Ese archivo no es una imagen válida.')); };
      img.src = url;
    });
  }
  function subirFotos(files) {
    var er = $('#e-foto-err'); er.hidden = true;
    var lista = Array.prototype.slice.call(files, 0, 12 - ed.galeria.length);
    var b = $('#e-subir'); if (b) { b.disabled = true; b.textContent = 'Subiendo…'; }
    lista.reduce(function (pr, f) {
      return pr.then(function () { return prepararFoto(f); }).then(function (datos) { return api('subir', null, { cod: ed.nuevo ? '' : ed.cod, tipo: 'image/webp', datos: datos }); }).then(function (r) { ed.galeria.push(r.url); pintarFotos(); });
    }, Promise.resolve()).catch(function (e) { if (e.message !== 'sesion') { er.textContent = e.message; er.hidden = false; } pintarFotos(); });
  }
  function guardarProducto() {
    var e = ed, er = $('#e-err'), b = $('#e-guardar');
    var mal = function (t) { er.textContent = t; er.hidden = false; er.scrollIntoView({ block: 'center' }); };
    if (e.nuevo && !/^[A-Z]{3}-\d{3}$/.test(String(e.cod).toUpperCase())) return mal('El código debe tener 3 letras, un guion y 3 números, por ejemplo LAP-007.');
    if (String(e.nombre).trim().length < 3) return mal('Escribe el nombre del producto.');
    if (!String(e.marca).trim()) return mal('Escribe la marca.');
    if (!(Number(e.precio) > 0)) return mal('Escribe el precio con IVA.');
    if (e.nuevo && Number(e.existencia) > 0 && e.costo_unitario === '') return mal('Escribe el costo unitario sin IVA de la existencia inicial.');
    var cuerpo = {
      nuevo: e.nuevo, cod: String(e.cod).toUpperCase().trim(), nombre: e.nombre, categoria: e.categoria, marca: e.marca, specs_corto: e.specs_corto, resumen: e.resumen,
      descripcion_larga: e.descripcion_larga, precio: Number(e.precio), activo: e.activo, existencia: Number(e.existencia) || 0, costo_unitario: Number(e.costo_unitario) || 0,
      puntos: e.puntos.filter(function (x) { return x[0].trim(); }), especificaciones: e.especificaciones.filter(function (x) { return x[0].trim() && x[1].trim(); }),
      galeria: e.galeria, versiones: e.versiones.filter(function (g) { return g.t.trim() && g.ops.filter(function (o) { return o[0].trim(); }).length >= 2; }).map(function (g) { return { t: g.t, color: g.color, ops: g.ops.filter(function (o) { return o[0].trim(); }) }; })
    };
    b.disabled = true; er.hidden = true;
    api('producto_guardar', null, cuerpo).then(function () { cerrar(); aviso(e.nuevo ? 'Producto ' + cuerpo.cod + ' creado' : 'Cambios guardados en ' + cuerpo.cod); ruta(); },
      function (x) { if (x.message === 'sesion') return; b.disabled = false; mal(x.message); });
  }
  /* Eventos del editor (delegados en el diálogo). */
  dlg.addEventListener('input', function (ev) {
    if (!ed || !dlg.classList.contains('editor')) return;
    var t = ev.target, d = t.dataset;
    if (d.e) { ed[d.e] = t.type === 'checkbox' ? t.checked : t.value; if (d.e === 'precio') $('#calc-precio').textContent = calcPrecio(); if (d.e === 'categoria' && ed.nuevo) { ed.cod = siguienteCodigo(t.value); var c = $('#e-cod'); if (c) c.value = ed.cod; } }
    else if (d.punto !== undefined) ed.puntos[+d.punto][+d.k] = t.value;
    else if (d.spec !== undefined) ed.especificaciones[+d.spec][+d.k] = t.value;
    else if (d.grupo !== undefined) ed.versiones[+d.grupo].t = t.value;
    else if (d.grupoColor !== undefined) { ed.versiones[+d.grupoColor].color = t.checked; pintarEditorConservando(); }
    else if (d.op) { var p = d.op.split('-'); ed.versiones[+p[0]].ops[+p[1]][+d.k] = d.k === '1' ? Number(t.value) || 0 : t.value; }
  });
  dlg.addEventListener('change', function (ev) { if (ev.target.id === 'e-archivo' && ev.target.files.length) subirFotos(ev.target.files); });
  function pintarEditorConservando() { var y = dlg.scrollTop; pintarEditor(); dlg.scrollTop = y; }
  dlg.addEventListener('click', function (ev) {
    if (!ed || !dlg.classList.contains('editor')) return;
    var t = ev.target.closest('button'); if (!t) return; var d = t.dataset;
    if (t.id === 'e-subir') $('#e-archivo').click();
    else if (t.id === 'e-guardar') guardarProducto();
    else if (t.id === 'e-mas-spec') { ed.especificaciones.push(['', '']); pintarEditorConservando(); }
    else if (t.id === 'e-mas-grupo') { if (ed.versiones.length >= 4) return; ed.versiones.push({ t: '', color: false, ops: [['', 0, null, null, null], ['', 0, null, null, null]] }); pintarEditorConservando(); }
    else if (d.quitarSpec !== undefined) { ed.especificaciones.splice(+d.quitarSpec, 1); pintarEditorConservando(); }
    else if (d.quitarGrupo !== undefined) { ed.versiones.splice(+d.quitarGrupo, 1); pintarEditorConservando(); }
    else if (d.masOp !== undefined) { var g = ed.versiones[+d.masOp]; if (g.ops.length < 8) { g.ops.push(['', 0, g.color ? '#cccccc' : null, null, null]); pintarEditorConservando(); } }
    else if (d.quitarOp) { var q = d.quitarOp.split('-'); ed.versiones[+q[0]].ops.splice(+q[1], 1); pintarEditorConservando(); }
    else if (d.fotoQuitar !== undefined) { ed.galeria.splice(+d.fotoQuitar, 1); pintarFotos(); }
    else if (d.fotoIzq !== undefined) { var i = +d.fotoIzq; ed.galeria.splice(i - 1, 0, ed.galeria.splice(i, 1)[0]); pintarFotos(); }
    else if (d.fotoDer !== undefined) { var j = +d.fotoDer; ed.galeria.splice(j + 1, 0, ed.galeria.splice(j, 1)[0]); pintarFotos(); }
  });

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var ed2 = e.target.closest('[data-editar]'); if (ed2 && !dlg.open) { abrirEditor(ed2.dataset.editar); return; }
    var t = e.target.closest('[data-kardex],[data-compra],[data-ajuste],[data-factura]'); if (!t) return;
    if (t.dataset.kardex) dKardex(t.dataset.kardex);
    else if (t.dataset.compra) dCompra(t.dataset.compra);
    else if (t.dataset.ajuste) dAjuste(t.dataset.ajuste);
    else if (t.dataset.factura) dFactura(+t.dataset.factura);
  });

  if (sesion) entrar(); else salir();
})();
