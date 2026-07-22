import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { SanitizeHtml } from '../../common/decorators';

export class RejectOrderDto {
  @ApiPropertyOptional({ example: 'No tengo suficiente stock disponible por el momento' })
  @SanitizeHtml()
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
