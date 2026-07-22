import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiCreatedResponse, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto';

/**
 * Documenta la forma real de respuesta 200 que produce `TransformInterceptor`:
 * `{ success, data, timestamp }`. `dataType` es opcional — se omite cuando no
 * existe un DTO que represente razonablemente el recurso devuelto. `isArray`
 * documenta `data` como un arreglo de `dataType` (listas sin paginar).
 */
export function ApiOkResponseData(dataType?: Type<unknown>, options?: { isArray?: boolean }) {
  const dataSchema = dataType
    ? options?.isArray
      ? { type: 'array', items: { $ref: getSchemaPath(dataType) } }
      : { $ref: getSchemaPath(dataType) }
    : { type: 'object' };

  return applyDecorators(
    ...(dataType ? [ApiExtraModels(dataType)] : []),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: dataSchema,
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
  );
}

/** Igual que `ApiOkResponseData`, pero para respuestas 201 Created. */
export function ApiCreatedResponseData(dataType?: Type<unknown>) {
  return applyDecorators(
    ...(dataType ? [ApiExtraModels(dataType)] : []),
    ApiCreatedResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: dataType ? { $ref: getSchemaPath(dataType) } : { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
  );
}

/**
 * Documenta la forma de paginación realmente usada en todo el proyecto:
 * `{ success, data: { data: T[], total, page, limit }, timestamp }`.
 */
export function ApiPaginatedResponseData(dataType: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(dataType),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(dataType) } },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
  );
}

/**
 * Documenta los errores comunes (misma forma en toda la API, producida por
 * AllExceptionsFilter/HttpExceptionFilter). Se aplica una sola vez a nivel de
 * controlador — Swagger propaga `@ApiResponse` de clase a todas sus rutas.
 */
export function ApiCommonErrorResponses() {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({ status: 400, description: 'Solicitud inválida', type: ErrorResponseDto }),
    ApiResponse({ status: 401, description: 'No autenticado', type: ErrorResponseDto }),
    ApiResponse({ status: 403, description: 'Sin permisos suficientes', type: ErrorResponseDto }),
    ApiResponse({ status: 404, description: 'Recurso no encontrado', type: ErrorResponseDto }),
    ApiResponse({ status: 409, description: 'Conflicto con el estado actual del recurso', type: ErrorResponseDto }),
    ApiResponse({ status: 429, description: 'Demasiadas solicitudes', type: ErrorResponseDto }),
  );
}
