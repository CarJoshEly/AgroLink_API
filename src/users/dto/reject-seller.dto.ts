import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RejectSellerDto {
  @ApiProperty({ example: 'La fotografía del DNI no es legible' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo del rechazo es obligatorio' })
  @MinLength(5)
  reason: string;
}
