/* POST /api/paypal/capturar { orderID } → cobra la orden aprobada por el comprador. */
const { leerJSON, enviar, limitar, paypal } = require('../_util');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return enviar(res, 405, { error: 'Método no permitido.' });
  if (!limitar(req, 20, 10 * 60 * 1000)) return enviar(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
  try {
    const { orderID } = await leerJSON(req);
    if (!/^[A-Z0-9]{8,32}$/.test(String(orderID || ''))) return enviar(res, 400, { error: 'Orden inválida.' });
    const r = await paypal('/v2/checkout/orders/' + orderID + '/capture', { method: 'POST' });
    const cap = r.purchase_units?.[0]?.payments?.captures?.[0];
    enviar(res, 200, { status: r.status, captura: cap?.id || '', monto: cap?.amount?.value || '' });
  } catch (e) {
    const detalle = e.paypal?.details?.[0]?.issue;
    enviar(res, 400, { error: detalle === 'INSTRUMENT_DECLINED' ? 'PayPal rechazó el método de pago. Prueba con otro.' : e.message, issue: detalle || '' });
  }
};
