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
