/* UniónDev · factura de consumidor final (navegador y servidor).
   - armarFactura(): recalcula precios desde el catálogo; nunca confía en montos enviados por el cliente.
   - crearPDF(): dibuja la factura con jsPDF (mismo diseño en el navegador y en el correo). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./datos.js'));
  else root.UDFactura = factory(root.UDDatos);
})(typeof self !== 'undefined' ? self : this, function (UD) {
  'use strict';
  var r2 = UD.r2;
  var EMPRESA = { nombre: 'UNIONDEV, S.A. de C.V.', giro: 'Venta al por menor de computadoras y periféricos', nit: '0614-011026-101-4', nrc: '312045-7', dir: 'San Salvador, El Salvador' };
  var ENVIO = 4.00; /* entrega a domicilio, IVA incluido */
  var MUNICIPIOS = ['San Salvador Centro', 'San Salvador Norte', 'San Salvador Sur', 'San Salvador Este', 'San Salvador Oeste'];
  /* Tarjetas de la pasarela de prueba. Ningún cobro es real. */
  var PRUEBA = {
    '4242424242424242': { marca: 'Visa', res: 'ok', txt: 'Aprobada' },
    '5555555555554444': { marca: 'Mastercard', res: 'ok', txt: 'Aprobada' },
    '4000000000003220': { marca: 'Visa', res: '3ds', txt: 'Pide código del banco' },
    '4000000000000002': { marca: 'Visa', res: 'rechazada', txt: 'Rechazada' }
  };
  var METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia bancaria', 'tarjeta-prueba': 'Tarjeta', paypal: 'PayPal' };

  function money(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var UNI = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  var DEC = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  var CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function menorMil(n) { if (n === 0) return ''; if (n === 100) return 'CIEN'; var c = Math.floor(n / 100), r = n % 100, s = CEN[c]; if (r) s += (s ? ' ' : '') + (r < 30 ? UNI[r] : DEC[Math.floor(r / 10)] + (r % 10 ? ' Y ' + UNI[r % 10] : '')); return s; }
  function apoc(s) { return s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN'); }
  function enLetras(m) {
    var e = Math.floor(r2(m)), c = Math.round((r2(m) - e) * 100), t;
    if (e === 0) t = 'CERO'; else { var mi = Math.floor(e / 1000), re = e % 1000, p = []; if (mi) p.push(mi === 1 ? 'MIL' : apoc(menorMil(mi)) + ' MIL'); if (re) p.push(apoc(menorMil(re))); t = p.join(' '); }
    return t + ' ' + String(c).padStart(2, '0') + '/100 DÓLARES';
  }
  function fechaSV(iso) { try { return new Date(iso).toLocaleString('es-SV', { timeZone: 'America/El_Salvador', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } }
  function condicion(f) {
    var pago = f.tarjeta ? 'Tarjeta ' + f.tarjeta.marca + ' •••• ' + f.tarjeta.ult4 + ' · Autorización ' + f.tarjeta.aut
      : f.paypal ? 'PayPal · Transacción ' + f.paypal.captura : METODOS[f.pago] || f.pago;
    return 'Contado · ' + pago;
  }

  /* Valida un pedido y calcula la factura. Lanza Error con un mensaje para el cliente si algo no cuadra. */
  /* opts.sinLimite: no compara con las existencias del catálogo (la base de datos las valida al emitir). */
  function armarFactura(ped, opts) {
    opts = opts || {};
    if (!ped || !Array.isArray(ped.items) || !ped.items.length) throw new Error('El carrito está vacío.');
    if (ped.items.length > 30) throw new Error('Demasiados productos en un solo pedido.');
    var c = ped.cliente || {};
    var nombre = String(c.nombre || '').trim().slice(0, 80), correo = String(c.correo || '').trim().slice(0, 120);
    if (nombre.length < 3) throw new Error('Falta el nombre del cliente.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) throw new Error('El correo no es válido.');
    var entrega = ped.entrega === 'domicilio' ? 'domicilio' : 'tienda';
    var tel = String(c.tel || '').trim().slice(0, 15), dir = String(ped.dir || '').trim().slice(0, 160);
    if (entrega === 'domicilio' && (tel.replace(/\D/g, '').length !== 8 || dir.length < 8)) throw new Error('Faltan el teléfono o la dirección de entrega.');
    var municipio = MUNICIPIOS.indexOf(ped.municipio) >= 0 ? ped.municipio : MUNICIPIOS[0];
    var pago = METODOS[ped.pago] ? ped.pago : 'efectivo';
    var items = [], iva = 0, total = 0;
    ped.items.forEach(function (it) {
      var p = UD.by(it.cod), q = parseInt(it.q, 10), sel = it.sel || [];
      if (!p || !UD.selValida(p, sel)) throw new Error('Un producto del carrito ya no está disponible.');
      if (!(q >= 1 && q <= (UD.esBase(sel) ? (opts.sinLimite ? 99 : p.stock) : 5))) throw new Error('La cantidad de ' + p.nombre + ' no está disponible.');
      var pr = UD.precioDe(p, sel);
      items.push({ cod: p.cod, desc: p.nombre, ver: UD.nombreVar(p, sel), encargo: !UD.esBase(sel), q: q, pu: pr.tot, tot: r2(pr.tot * q), sin: r2(pr.sin * q), iva: r2(pr.iva * q) });
      total += pr.tot * q; iva += pr.iva * q;
    });
    if (entrega === 'domicilio') {
      var ivaE = r2(ENVIO - ENVIO / 1.13);
      items.push({ cod: 'SERV-ENV', desc: 'Servicio de entrega a domicilio', ver: municipio, q: 1, pu: ENVIO, tot: ENVIO, sin: r2(ENVIO - ivaE), iva: ivaE });
      total += ENVIO; iva += ivaE;
    }
    total = r2(total); iva = r2(iva);
    return {
      fecha: new Date().toISOString(),
      cliente: { nombre: nombre, correo: correo, tel: tel, dui: /^\d{8}-\d$/.test(String(c.dui || '').trim()) ? String(c.dui).trim() : '' },
      entrega: entrega, municipio: municipio, dir: entrega === 'domicilio' ? dir : '', ref: String(ped.ref || '').trim().slice(0, 200), pago: pago,
      items: items, total: total, iva: iva, gravadas: r2(total - iva)
    };
  }

  /* PDF con jsPDF. `jsPDF` es el constructor (window.jspdf.jsPDF o require('jspdf').jsPDF). */
  function crearPDF(jsPDF, f, logo) {
    var doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true }), W = 210, M = 16, y = 18;
    var gris = [91, 97, 112], negro = [27, 30, 36];
    var color = function (c) { doc.setTextColor(c[0], c[1], c[2]); };
    if (logo) doc.addImage(logo, 'PNG', M, y - 2, 11, 12.7);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); color(negro); doc.text(EMPRESA.nombre, M + 15, y + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(gris);
    doc.text([EMPRESA.giro, 'NIT ' + EMPRESA.nit + ' · NRC ' + EMPRESA.nrc, EMPRESA.dir], M + 15, y + 7);
    var bx = 118, bw = W - M - bx; doc.setDrawColor(negro[0], negro[1], negro[2]); doc.setLineWidth(0.4); doc.roundedRect(bx, y - 4, bw, 30, 2, 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); color(negro); doc.text('FACTURA CONSUMIDOR FINAL', bx + 4, y + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); color(gris);
    doc.text(['Documento tributario electrónico', 'N.º de control: ' + f.control, 'Código de generación:', f.codigo, 'Fecha y hora: ' + fechaSV(f.fecha)], bx + 4, y + 7);
    y += 32; doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 7;
    var dato = function (lab, val, x, yy) { doc.setFontSize(7); color(gris); doc.text(lab.toUpperCase(), x, yy); doc.setFontSize(9.5); color(negro); var l = doc.splitTextToSize(String(val), 82); doc.text(l, x, yy + 4.5); return l.length; };
    var par = function (a, b) { var n = Math.max(a ? dato(a[0], a[1], M, y) : 1, b ? dato(b[0], b[1], 110, y) : 1); y += 8 + n * 4.2; };
    par(['Cliente', f.cliente.nombre], ['Correo', f.cliente.correo]);
    par(['Condición de la operación', condicion(f)], ['Entrega', f.entrega === 'domicilio' ? f.dir + ', ' + f.municipio : 'Recoger en tienda']);
    if (f.cliente.dui || f.cliente.tel) par(f.cliente.dui ? ['DUI', f.cliente.dui] : null, f.cliente.tel ? ['Teléfono', f.cliente.tel] : null);
    doc.setFillColor(243, 245, 248); doc.rect(M, y, W - 2 * M, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); color(gris);
    doc.text('CANT.', M + 2, y + 5.3); doc.text('DESCRIPCIÓN', M + 16, y + 5.3); doc.text('PRECIO UNITARIO', 160, y + 5.3, { align: 'right' }); doc.text('VENTAS GRAVADAS', W - M - 2, y + 5.3, { align: 'right' });
    y += 13; doc.setFont('helvetica', 'normal');
    f.items.forEach(function (it) {
      var lin = doc.splitTextToSize(it.desc, 100), sub = it.cod + (it.ver ? ' · ' + it.ver : '') + (it.encargo ? ' · por encargo' : '');
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setFontSize(9.5); color(negro); doc.text(String(it.q), M + 2, y); doc.text(lin, M + 16, y);
      doc.text(money(it.pu), 160, y, { align: 'right' }); doc.text(money(it.tot), W - M - 2, y, { align: 'right' });
      y += lin.length * 4.4; doc.setFontSize(7.5); color(gris); doc.text(doc.splitTextToSize(sub, 100), M + 16, y); y += 4;
      doc.setDrawColor(230, 233, 238); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 6;
    });
    y += 2; var sx = 128, vx = W - M - 2;
    var suma = function (lab, val, fuerte) { doc.setFont('helvetica', fuerte ? 'bold' : 'normal'); doc.setFontSize(fuerte ? 12 : 9); color(fuerte ? negro : gris); doc.text(lab, sx, y); doc.text(val, vx, y, { align: 'right' }); y += fuerte ? 7 : 5; };
    var yl = y; suma('Sumas', money(f.total)); suma('Ventas exentas', '$0.00'); suma('Ventas no sujetas', '$0.00');
    doc.setDrawColor(negro[0], negro[1], negro[2]); doc.setLineWidth(0.5); doc.line(sx, y - 2, vx, y - 2); y += 3;
    suma('Total a pagar', money(f.total), true); suma('IVA incluido (13 %)', money(f.iva)); suma('Valor sin IVA', money(f.gravadas));
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); color(gris); doc.text('Son:', M, yl);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); color(negro); doc.text(doc.splitTextToSize(enLetras(f.total), 100), M, yl + 5);
    y += 6; doc.setDrawColor(207, 213, 222); doc.setLineDashPattern([1, 1], 0); doc.line(M, y, W - M, y); doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(107, 112, 128);
    var nota = 'En la factura de consumidor final los precios incluyen el IVA. Documento de muestra de un proyecto académico de Técnicas Contables: no tiene validez fiscal ante el Ministerio de Hacienda.';
    if (f.tarjeta) nota += ' Pago con tarjeta en modo de prueba, sin cobro real.';
    if (f.paypal) nota += ' Pago procesado en PayPal Sandbox (entorno de pruebas).';
    doc.text(doc.splitTextToSize(nota, W - 2 * M), M, y + 5);
    return doc;
  }

  return { EMPRESA: EMPRESA, ENVIO: ENVIO, MUNICIPIOS: MUNICIPIOS, PRUEBA: PRUEBA, METODOS: METODOS,
    money: money, enLetras: enLetras, fechaSV: fechaSV, condicion: condicion, armarFactura: armarFactura, crearPDF: crearPDF };
});
