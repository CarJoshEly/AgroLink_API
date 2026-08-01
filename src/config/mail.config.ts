import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  // Cuenta de Gmail del proyecto usada como remitente vía SMTP. `gmailAppPassword`
  // es una contraseña de aplicación (myaccount.google.com/apppasswords, requiere
  // verificación en 2 pasos activa) — nunca la contraseña normal de la cuenta.
  gmailUser: process.env.GMAIL_USER,
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
  fromAddress: process.env.MAIL_FROM_ADDRESS || 'AgroLink Honduras <agrolink.hn@gmail.com>',
  // Dominio del frontend al que apuntan los enlaces de verificación/recuperación.
  webAppUrl: process.env.WEB_APP_URL || 'https://agrolink.hn',
  // Bandeja donde el equipo revisa solicitudes de verificación de vendedor.
  adminEmail: process.env.ADMIN_NOTIFY_EMAIL || 'agrolink.hn@gmail.com',
}));
