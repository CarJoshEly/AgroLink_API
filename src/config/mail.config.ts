import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  // API key de Brevo (brevo.com) — el correo se manda por su API HTTPS en vez
  // de SMTP directo. SMTP saliente desde Render resultó poco confiable hacia
  // Gmail (bloqueos/timeouts intermitentes, IPv6 sin ruta); una API por HTTPS
  // no tiene ese problema porque usa el puerto 443, igual que cualquier otra
  // petición saliente normal de la app.
  brevoApiKey: process.env.BREVO_API_KEY,
  fromAddress: process.env.MAIL_FROM_ADDRESS || 'AgroLink Honduras <agrolink.hn@gmail.com>',
  // Dominio del frontend al que apuntan los enlaces de verificación/recuperación.
  webAppUrl: process.env.WEB_APP_URL || 'https://agrolink.hn',
  // Bandeja donde el equipo revisa solicitudes de verificación de vendedor.
  adminEmail: process.env.ADMIN_NOTIFY_EMAIL || 'agrolink.hn@gmail.com',
}));
