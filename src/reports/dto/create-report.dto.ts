import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';
import { ReportTargetType } from '@prisma/client';
import { SanitizeHtml } from '../../common/decorators';

// El valor legado REVIEW se excluye a propósito: los reportes nuevos deben
// usar PRODUCT_REVIEW o SELLER_REVIEW ahora que las reseñas están divididas.
const ALLOWED_TARGET_TYPES = [
  ReportTargetType.PRODUCT,
  ReportTargetType.SELLER,
  ReportTargetType.PRODUCT_REVIEW,
  ReportTargetType.SELLER_REVIEW,
];

export class CreateReportDto {
  @ApiProperty({ enum: ALLOWED_TARGET_TYPES })
  @IsIn(ALLOWED_TARGET_TYPES)
  targetType: ReportTargetType;

  @ApiProperty({ description: 'ID del producto, vendedor o reseña reportada' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ example: 'El producto no coincide con la descripción' })
  @SanitizeHtml()
  @IsString()
  @IsNotEmpty({ message: 'El motivo del reporte es obligatorio' })
  @MinLength(5)
  reason: string;
}
