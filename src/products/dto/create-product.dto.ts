import { ApiProperty } from '@nestjs/swagger';
import { ProductUnit } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'ID de la categoría' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'Maíz Amarillo de Primera' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'Maíz amarillo cosechado en la temporada actual, grano seleccionado.' })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({ example: 450.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ enum: ProductUnit })
  @IsEnum(ProductUnit)
  unit: ProductUnit;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0)
  stock: number;
}
