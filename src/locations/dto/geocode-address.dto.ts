import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class GeocodeAddressDto {
  @ApiProperty({ example: 'Parque Central, Tegucigalpa, Honduras' })
  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  @MinLength(5)
  address: string;
}
