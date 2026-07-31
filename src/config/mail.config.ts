import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  // Dominio de pruebas de Resend: solo entrega al correo con el que se creó
  // la cuenta de Resend, hasta que se verifique un dominio propio.
  fromAddress: process.env.MAIL_FROM_ADDRESS || 'AgroLink Honduras <onboarding@resend.dev>',
}));
