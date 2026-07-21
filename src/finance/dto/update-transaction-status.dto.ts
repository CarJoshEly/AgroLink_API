import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TransactionStatus } from '@prisma/client';

const ALLOWED_STATUSES = [
  TransactionStatus.COMPLETED,
  TransactionStatus.FAILED,
  TransactionStatus.REFUNDED,
];

export class UpdateTransactionStatusDto {
  @ApiProperty({ enum: ALLOWED_STATUSES })
  @IsIn(ALLOWED_STATUSES)
  status: TransactionStatus;

  @ApiPropertyOptional({ description: 'Referencia externa del proveedor de pago (ej. ID de transacción PayPal)' })
  @IsOptional()
  @IsString()
  externalReference?: string;
}
