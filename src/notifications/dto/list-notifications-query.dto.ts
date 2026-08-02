import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { NotificationType } from '@prisma/client';
import { ParseBooleanQuery } from '../../common/decorators';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  // Tipado `any` a propósito: si esto fuera `boolean`, el
  // `enableImplicitConversion: true` global (main.ts) pisa el resultado de
  // `@ParseBooleanQuery()` con `Boolean(valorCrudo)` — que es `true` para
  // cualquier string no vacío, incluyendo `"false"`. Con `any`,
  // class-transformer no reconoce el `design:type` como `Boolean` y no
  // aplica esa conversión implícita, dejando el `@Transform` como única
  // fuente de verdad. `@IsBoolean()` sigue validando el valor en runtime.
  @ApiPropertyOptional()
  @IsOptional()
  @ParseBooleanQuery()
  @IsBoolean()
  isRead?: any;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 10);
  }
}
