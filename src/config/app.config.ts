import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const port = parseInt(process.env.PORT || '', 10) || 3000;
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port,
    apiPrefix: process.env.API_PREFIX || 'api',
    apiVersion: process.env.API_VERSION || 'v1',
    // URL pública por la que se llega a ESTA api (no la del frontend web,
    // esa es `mail.webAppUrl`) — la necesita PayPal como `return_url`/
    // `cancel_url` del checkout redirigido que usa el WebView de la app
    // móvil (ver payments/paypal-payments.service.ts).
    publicUrl: process.env.API_PUBLIC_URL || `http://localhost:${port}`,
  };
});
