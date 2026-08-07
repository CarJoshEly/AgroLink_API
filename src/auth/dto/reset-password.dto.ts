import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH, STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_REGEX } from '../../common/constants';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de recuperación recibido por correo' })
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;

  @ApiProperty({ example: 'NuevaSegura#123' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MESSAGE })
  newPassword: string;
}
