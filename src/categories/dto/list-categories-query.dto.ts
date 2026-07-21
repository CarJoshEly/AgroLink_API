import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por categoría padre (vacío = raíz + subcategorías, todas)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
