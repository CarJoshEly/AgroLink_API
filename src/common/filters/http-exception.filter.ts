import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly securityLogger = new Logger('Security');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const error =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as Record<string, unknown>);

    const errorResponse = {
      success: false,
      statusCode: status,
      message: error.message || exception.message,
      error: error.error || exception.name,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.warn(
      `[${request.method}] ${request.url} — ${status} — ${JSON.stringify(error.message)}`,
    );

    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      this.securityLogger.warn(
        `[${request.method}] ${request.url} — ${status} — ip=${request.ip}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
