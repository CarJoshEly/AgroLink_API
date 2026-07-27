import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface TransformResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

/** Shape crudo que devuelven varios *.service.ts en vez de usar ApiResponseDto.paginated(). */
interface RawPaginatedResult {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
}

function isRawPaginatedResult(value: unknown): value is RawPaginatedResult {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as RawPaginatedResult).data) &&
    typeof (value as RawPaginatedResult).total === 'number' &&
    typeof (value as RawPaginatedResult).page === 'number' &&
    typeof (value as RawPaginatedResult).limit === 'number'
  );
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        // Si la respuesta ya tiene el formato estándar, no transformar
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }

        // Normaliza el shape crudo { data, total, page, limit } que devuelven
        // products.service, reviews.service, orders.service, etc. al mismo
        // formato { data, meta } que produce ApiResponseDto.paginated().
        if (isRawPaginatedResult(result)) {
          const { data, total, page, limit } = result;
          const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
          return {
            success: true,
            data,
            meta: {
              total,
              page,
              limit,
              totalPages,
              hasPreviousPage: page > 1,
              hasNextPage: page < totalPages,
            },
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}