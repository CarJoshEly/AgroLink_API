import { Transform } from 'class-transformer';

/**
 * Convierte un booleano de query string ("true"/"false") a un `boolean` real
 * antes de validar con `@IsBoolean()`.
 *
 * `@Type(() => Boolean)` NO sirve para esto: para primitivos, class-transformer
 * hace `Boolean(value)`, y `Boolean('false')` da `true` (cualquier string no
 * vacío es "truthy") — un filtro `?isRead=false` terminaba validando como
 * `true` y devolviendo justo lo contrario de lo pedido.
 */
export const ParseBooleanQuery = () =>
  Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });
