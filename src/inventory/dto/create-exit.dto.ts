import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateExitDto {
  @ApiProperty({ example: 5, description: 'Cantidad que sale del inventario' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Producto dañado' })
  @IsOptional()
  @IsString()
  reason?: string;
}
