import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty({ description: 'Total de registros' })
  total: number;

  @ApiProperty({ description: 'Página actual' })
  page: number;

  @ApiProperty({ description: 'Registros por página' })
  limit: number;

  @ApiProperty({ description: 'Total de páginas' })
  totalPages: number;

  @ApiProperty({ description: '¿Tiene página anterior?' })
  hasPreviousPage: boolean;

  @ApiProperty({ description: '¿Tiene página siguiente?' })
  hasNextPage: boolean;
}

export class ApiResponseDto<T> {
  @ApiProperty({ description: 'Indica si la operación fue exitosa' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Datos de la respuesta' })
  data?: T;

  @ApiPropertyOptional({ description: 'Mensaje descriptivo' })
  message?: string;

  @ApiPropertyOptional({
    description: 'Metadatos de paginación',
    type: PaginationMeta,
  })
  meta?: PaginationMeta;

  @ApiProperty({ description: 'Fecha y hora de la respuesta' })
  timestamp: string;

  constructor(partial: Partial<ApiResponseDto<T>>) {
    Object.assign(this, partial);
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data: T, message?: string): ApiResponseDto<T> {
    return new ApiResponseDto({
      success: true,
      data,
      message,
    });
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): ApiResponseDto<T[]> {
    const totalPages = Math.ceil(total / limit);
    return new ApiResponseDto({
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
    });
  }

  static error(message: string): ApiResponseDto<null> {
    return new ApiResponseDto({
      success: false,
      message,
      data: null,
    });
  }
}
