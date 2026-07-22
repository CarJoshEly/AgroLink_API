import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { SanitizeHtml } from '../../common/decorators';

export class CreateProductReviewDto {
  @ApiProperty({ description: 'ID del artículo del pedido (OrderItem) que se está reseñando' })
  @IsUUID()
  orderItemId: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Excelente calidad, tal como se describe.' })
  @SanitizeHtml()
  @IsOptional()
  @IsString()
  comment?: string;
}
