import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SanitizeHtml } from '../../common/decorators';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'María Fernández' })
  @SanitizeHtml()
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '99887766' })
  @IsOptional()
  @IsString()
  phone?: string;
}
