// ==========================================================================
// Interfaces globales de AgroLink Honduras
// ==========================================================================

/**
 * Interface para el payload del JWT
 */
export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
}

/**
 * Interface para request autenticado (Express + JWT)
 */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * Interface genérica para respuesta paginada
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
