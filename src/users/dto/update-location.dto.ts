import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateLocationDto {
  @ApiProperty({ description: 'ID del departamento (catálogo geográfico)' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ description: 'ID del municipio (catálogo geográfico)' })
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ example: 'Barrio El Centro, 2da calle' })
  @IsString()
  @MinLength(5)
  address: string;

  @ApiProperty({ example: 14.0723 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -87.1921 })
  @IsLongitude()
  longitude: number;
}
