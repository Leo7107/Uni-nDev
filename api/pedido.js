/* POST /api/pedido → valida el pedido, comprueba el pago, emite la factura de consumidor final y la envía por correo con el PDF. */
const { ENV, leerJSON, enviar, limitar, paypal } = require('./_util');
const F = require('../lib/factura.js');
const LOGO = require('../lib/logo.js');
const { jsPDF } = require('jspdf');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const TARJETAS_OK = { '4242': 'Visa', '4444': 'Mastercard', '3220': 'Visa' }; /* tarjetas de prueba que aprueban */

function correoHTML(f) {
  const filas = f.items.map(it => `<tr><td style="padding:8px 0;border-bottom:1px solid #e6e9ee">${it.q} × ${esc(it.desc)}<br><span style="color:#6b7080;font-size:12px">${esc(it.ver || it.cod)}</span></td><td style="padding:8px 0;border-bottom:1px solid #e6e9ee;text-align:right;white-space:nowrap">${F.money(it.tot)}</td></tr>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#16181d">
  <p style="font-size:20px;font-weight:bold;margin:0 0 4px"><span style="color:#16181d">Unión</span><span style="color:#1f4fd8">Dev</span></p>
  <h1 style="font-size:22px;margin:18px 0 8px">¡Gracias por tu compra, ${esc(f.cliente.nombre.split(' ')[0])}!</h1>
  <p style="color:#4a4f5c;margin:0 0 16px">Adjuntamos tu factura de consumidor final en PDF. ${f.entrega === 'domicilio' ? 'Te llevaremos tu pedido a ' + esc(f.municipio) + ' en 24 a 48 horas.' : 'Tu pedido estará listo para recoger en nuestra tienda de San Salvador en 2 horas.'}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${filas}
  <tr><td style="padding:10px 0 2px;color:#6b7080">IVA incluido (13 %)</td><td style="text-align:right;color:#6b7080">${F.money(f.iva)}</td></tr>
  <tr><td style="padding:4px 0;font-weight:bold;font-size:16px">Total</td><td style="text-align:right;font-weight:bold;font-size:16px">${F.money(f.total)}</td></tr></table>
  <p style="font-size:13px;color:#6b7080;margin-top:16px">N.º de control: ${f.control}<br>${esc(F.condicion(f))}</p>
  <p style="font-size:12px;color:#8a8f9c;margin-top:20px">UNIONDEV, S.A. de C.V. · Proyecto académico de Técnicas Contables. Documento sin validez fiscal.</p></div>`;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function enviarCorreo(f) {
  const prueba = ENV.CORREO_MODO === 'prueba'; /* local: arma el correo completo pero no lo envía */
  if (!prueba && (!ENV.GMAIL_USER || !ENV.GMAIL_APP_PASSWORD)) return { enviado: false, motivo: 'El correo no está configurado en el servidor.' };
  const pdf = Buffer.from(F.crearPDF(jsPDF, f, LOGO).output('arraybuffer'));
  const t = prueba ? nodemailer.createTransport({ jsonTransport: true }) : nodemailer.createTransport({ service: 'gmail', auth: { user: ENV.GMAIL_USER, pass: ENV.GMAIL_APP_PASSWORD } });
  const info = await t.sendMail({
    from: `"UniónDev" <${ENV.GMAIL_USER || 'tienda@uniondev.test'}>`, to: f.cliente.correo, ...(ENV.COPIA_FACTURAS ? { bcc: ENV.COPIA_FACTURAS } : {}),
    subject: `Tu factura UniónDev ${f.control.slice(-6)} · ${F.money(f.total)}`,
    html: correoHTML(f),
    attachments: [{ filename: `Factura-UnionDev-${f.control.slice(-6)}.pdf`, content: pdf, contentType: 'application/pdf' }]
  });
  if (prueba) { console.log('[correo de prueba] para', f.cliente.correo, '· PDF', pdf.length, 'bytes'); if (ENV.CORREO_GUARDAR) require('fs').writeFileSync(ENV.CORREO_GUARDAR, info.message); }
  return { enviado: true };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return enviar(res, 405, { error: 'Método no permitido.' });
  if (!limitar(req, 10, 10 * 60 * 1000)) return enviar(res, 429, { error: 'Demasiados pedidos seguidos. Espera unos minutos.' });
  let f;
  try {
    const ped = await leerJSON(req);
    f = F.armarFactura(ped);
    /* Comprueba el pago según el método. */
    if (f.pago === 'tarjeta-prueba') {
      const ult4 = String(ped.tarjeta?.ult4 || '');
      if (!TARJETAS_OK[ult4]) return enviar(res, 402, { error: 'La tarjeta de prueba no fue aprobada.' });
      f.tarjeta = { marca: TARJETAS_OK[ult4], ult4, aut: String(crypto.randomInt(100000, 999999)) };
    } else if (f.pago === 'paypal') {
      const id = String(ped.paypal?.orderID || '');
      if (!/^[A-Z0-9]{8,32}$/.test(id)) return enviar(res, 400, { error: 'Falta la orden de PayPal.' });
      const o = await paypal('/v2/checkout/orders/' + id);
      const cap = o.purchase_units?.[0]?.payments?.captures?.[0];
      if (o.status !== 'COMPLETED' || !cap || Number(cap.amount?.value) !== f.total) return enviar(res, 402, { error: 'PayPal no confirmó el pago por el total del pedido.' });
      f.paypal = { orden: id, captura: cap.id };
    }
  } catch (e) { return enviar(res, 400, { error: e.message }); }

  /* Número de control (formato DTE). Sin base de datos se deriva de la hora; con base de datos sería un correlativo. */
  f.control = 'DTE-01-UD01P001-' + String(Date.now()).padStart(15, '0');
  f.codigo = crypto.randomUUID().toUpperCase();

  let email;
  try { email = await enviarCorreo(f); } catch (e) { console.error('correo', e); email = { enviado: false, motivo: 'No se pudo enviar el correo en este momento.' }; }
  enviar(res, 200, { factura: f, email });
};
