import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RejectOrderDto {
  @ApiPropertyOptional({ example: 'No tengo suficiente stock disponible por el momento' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
