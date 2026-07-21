import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class CalculateDistanceDto {
  @ApiProperty({ example: 14.0723 })
  @IsLatitude()
  originLatitude: number;

  @ApiProperty({ example: -87.1921 })
  @IsLongitude()
  originLongitude: number;

  @ApiProperty({ example: 15.5 })
  @IsLatitude()
  destinationLatitude: number;

  @ApiProperty({ example: -88.03 })
  @IsLongitude()
  destinationLongitude: number;
}
