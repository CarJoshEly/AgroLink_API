import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class CreateCommissionConfigDto {
  @ApiProperty({ example: 7.5, minimum: 0, maximum: 100, description: 'Porcentaje de comisión de la plataforma' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentage: number;
}
