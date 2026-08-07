import { registerAs } from '@nestjs/config';

/**
 * Client ID de tipo "Web application" en Google Cloud Console. Se usa como
 * `audience` para validar los ID tokens que llegan tanto de la web (Google
 * Identity Services) como de la app móvil — en Flutter, `google_sign_in` se
 * configura con este mismo valor como `serverClientId` para que el ID token
 * que emite tenga esta audiencia, aunque el usuario inicie sesión desde
 * Android. No es secreto — viaja también al frontend (`NEXT_PUBLIC_...`).
 */
export default registerAs('googleAuth', () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
}));
