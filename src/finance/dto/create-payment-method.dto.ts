import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePaymentMethodDto {
  @ApiProperty({ example: 'PayPal' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Configuración específica del proveedor (claves, endpoints, etc.)' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
