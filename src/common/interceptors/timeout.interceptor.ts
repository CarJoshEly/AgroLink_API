import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { DEFAULT_REQUEST_TIMEOUT } from '../constants';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs = DEFAULT_REQUEST_TIMEOUT;

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                'La solicitud ha excedido el tiempo máximo de espera',
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
