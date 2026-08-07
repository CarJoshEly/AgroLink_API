import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SanitizeHtml } from '../../common/decorators';
import { PASSWORD_MIN_LENGTH, STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_REGEX } from '../../common/constants';

export class RegisterBuyerDto {
  @ApiProperty({ example: 'María Fernández' })
  @SanitizeHtml()
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  @ApiProperty({ example: '99887766', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Segura#123' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  password: string;

  // La app móvil no puede abrir el link de verificación dentro de sí misma
  // (requeriría configurar deep links) — cuando manda 'mobile', el correo
  // solo trae el código de 6 dígitos, sin el link (ver MailService). Sin
  // este campo (p.ej. clientes web viejos) se asume 'web' y se manda el link.
  @ApiPropertyOptional({ enum: ['web', 'mobile'], default: 'web' })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  platform?: 'web' | 'mobile';
}
