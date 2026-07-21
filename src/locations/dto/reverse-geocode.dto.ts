import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class ReverseGeocodeDto {
  @ApiProperty({ example: 14.0723 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -87.1921 })
  @IsLongitude()
  longitude: number;
}
