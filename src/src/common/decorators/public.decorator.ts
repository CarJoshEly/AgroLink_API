import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorador para marcar endpoints como públicos.
 * Los endpoints marcados con @Public() no requerirán autenticación
 * cuando el AuthGuard esté implementado.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
