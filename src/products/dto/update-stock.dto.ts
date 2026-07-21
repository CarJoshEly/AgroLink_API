import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateStockDto {
  @ApiProperty({ example: 50, description: 'Nueva cantidad de existencias (valor absoluto)' })
  @IsInt()
  @Min(0)
  stock: number;
}
