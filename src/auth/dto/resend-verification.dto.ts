import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  // Ver RegisterBuyerDto#platform.
  @ApiPropertyOptional({ enum: ['web', 'mobile'], default: 'web' })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  platform?: 'web' | 'mobile';
}
