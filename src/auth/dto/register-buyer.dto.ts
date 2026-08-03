import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SanitizeHtml } from '../../common/decorators';

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

  @ApiProperty({ example: 'Segura123' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
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
