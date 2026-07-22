import { ApiProperty } from '@nestjs/swagger';

/** Forma exacta que producen AllExceptionsFilter/HttpExceptionFilter para cualquier error. */
export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: 'El valor proporcionado no es válido',
    description: 'Mensaje descriptivo del error (string) o lista de errores de validación (string[])',
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/products' })
  path: string;
}
