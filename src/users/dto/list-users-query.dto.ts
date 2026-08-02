import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ParseBooleanQuery } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

export class ListUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // Tipado `any` a propósito — ver comentario equivalente en
  // `ListNotificationsQueryDto.isRead`: con `boolean`, el
  // `enableImplicitConversion: true` global pisa `@ParseBooleanQuery()`
  // con `Boolean(valorCrudo)`, volviendo `"false"` en `true`.
  @ApiPropertyOptional()
  @IsOptional()
  @ParseBooleanQuery()
  @IsBoolean()
  isActive?: any;
}
