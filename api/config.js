/* GET /api/config → datos públicos que necesita el navegador (nunca el secreto). */
const { ENV, enviar } = require('./_util');
module.exports = (req, res) => enviar(res, 200, { paypalClientId: ENV.PAYPAL_CLIENT_ID || '', paypalEnv: ENV.PAYPAL_ENV || 'sandbox' });
