import { registerAs } from '@nestjs/config';

export default registerAs('paypal', () => ({
  clientId: process.env.PAYPAL_CLIENT_ID || 'tu_client_id_sandbox',
  secret: process.env.PAYPAL_SECRET || 'tu_secret_sandbox',
  mode: process.env.PAYPAL_MODE || 'sandbox',
}));
