/* POST /api/paypal/orden → crea la orden en PayPal con el total recalculado en el servidor. */
const { leerJSON, enviar, limitar, paypal } = require('../_util');
const F = require('../../lib/factura.js');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return enviar(res, 405, { error: 'Método no permitido.' });
  if (!limitar(req, 20, 10 * 60 * 1000)) return enviar(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
  try {
    const ped = await leerJSON(req);
    const f = F.armarFactura({ ...ped, pago: 'paypal' });
    const orden = await paypal('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ description: 'Compra en UniónDev (' + f.items.length + ' artículos)', amount: { currency_code: 'USD', value: f.total.toFixed(2) } }],
        application_context: { brand_name: 'UniónDev', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', locale: 'es-SV' }
      })
    });
    enviar(res, 200, { id: orden.id });
  } catch (e) { enviar(res, 400, { error: e.message }); }
};
