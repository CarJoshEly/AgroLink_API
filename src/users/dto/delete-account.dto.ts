import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'Contraseña actual, para confirmar la eliminación de la cuenta' })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria para confirmar esta acción' })
  currentPassword: string;
}
