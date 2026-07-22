import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

/**
 * Elimina cualquier etiqueta/atributo HTML de un campo de texto libre antes de validarlo.
 * Previene XSS almacenado en campos que luego pueda renderizar un cliente (nombre, descripción, comentarios, etc).
 */
export const SanitizeHtml = () =>
  Transform(({ value }) =>
    typeof value === 'string'
      ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
      : value,
  );
