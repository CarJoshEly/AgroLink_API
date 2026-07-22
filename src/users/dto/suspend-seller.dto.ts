import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { SanitizeHtml } from '../../common/decorators';

export class SuspendSellerDto {
  @ApiProperty({ example: 'Reportes múltiples de compradores por incumplimiento' })
  @SanitizeHtml()
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la suspensión es obligatorio' })
  @MinLength(5)
  reason: string;
}
