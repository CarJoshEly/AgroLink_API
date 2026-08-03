import { registerAs } from '@nestjs/config';

export default registerAs('paypal', () => ({
  clientId: process.env.PAYPAL_CLIENT_ID || 'tu_client_id_sandbox',
  secret: process.env.PAYPAL_SECRET || 'tu_secret_sandbox',
  mode: process.env.PAYPAL_MODE || 'sandbox',
  // AgroLink cobra en Lempiras pero PayPal no soporta HNL como moneda de
  // checkout — se convierte a USD con esta tasa fija antes de crear la
  // orden en PayPal. Mismo valor que usaba el cálculo hardcodeado en el
  // frontend web; ahora vive acá para que web y móvil no puedan divergir.
  hnlToUsdRate: Number(process.env.PAYPAL_HNL_TO_USD_RATE || '24.70'),
}));
