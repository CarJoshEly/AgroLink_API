// ==========================================================================
// Constantes globales de AgroLink Honduras
// ==========================================================================

/** Nombre de la aplicación */
export const APP_NAME = 'AgroLink Honduras';

/** Descripción de la aplicación */
export const APP_DESCRIPTION = 'Conectando el ecosistema agrícola hondureño';

/** Tiempo de expiración por defecto del JWT en segundos */
export const DEFAULT_JWT_EXPIRATION = '15m';

/** Tiempo de expiración del refresh token */
export const DEFAULT_REFRESH_EXPIRATION = '7d';

/** Límite de paginación por defecto */
export const DEFAULT_PAGE_LIMIT = 10;

/** Límite máximo de paginación */
export const MAX_PAGE_LIMIT = 100;

/** Tamaño máximo de archivo de imagen (5MB) */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** Extensiones de imagen permitidas */
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Tipos MIME de imagen permitidos */
export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Timeout de request por defecto en milisegundos (30 segundos) */
export const DEFAULT_REQUEST_TIMEOUT = 30000;

/** Número de rondas para bcrypt */
export const BCRYPT_SALT_ROUNDS = 12;

/**
 * Vigencia del código de verificación de correo (30 minutos). Se acortó al
 * pasar de un token largo (32 bytes al azar) a un código corto de 6 dígitos
 * pensado para copiar/pegar a mano — con mucha menos entropía, una ventana
 * de validez corta importa más para que no quede tiempo de adivinarlo
 * (ver también el throttle de POST /auth/verify-email).
 */
export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 30 * 60 * 1000;

/** Vigencia del código de recuperación de contraseña (15 minutos) — mismo motivo que arriba. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
