import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEntryDto {
  @ApiProperty({ example: 50, description: 'Cantidad que ingresa al inventario' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Nueva cosecha' })
  @IsOptional()
  @IsString()
  reason?: string;
}
