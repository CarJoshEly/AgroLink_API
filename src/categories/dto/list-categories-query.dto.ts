import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ParseBooleanQuery } from '../../common/decorators';

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por categoría padre (vacío = raíz + subcategorías, todas)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  // Tipado `any` a propósito — ver ListNotificationsQueryDto#isRead: con
  // `boolean` el `enableImplicitConversion: true` global pisa el resultado
  // de `@ParseBooleanQuery()`.
  @ApiPropertyOptional({
    default: false,
    description:
      'Por defecto solo se listan categorías activas (catálogo, formulario de producto). El panel admin ' +
      'manda esto en true para poder ver y reactivar las desactivadas.',
  })
  @IsOptional()
  @ParseBooleanQuery()
  @IsBoolean()
  includeInactive?: any;
}
