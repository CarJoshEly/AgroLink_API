import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListMunicipalitiesQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por departamento' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
