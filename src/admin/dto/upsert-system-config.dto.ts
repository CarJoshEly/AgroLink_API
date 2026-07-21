import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';

export class UpsertSystemConfigDto {
  @ApiProperty({ description: 'Valor de la configuración (cualquier valor serializable a JSON)' })
  @IsDefined()
  value: unknown;
}
