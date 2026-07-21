import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../common/decorators';
import type { JwtPayload } from '../common/interfaces';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, ListCategoriesQueryDto, UpdateCategoryDto } from './dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar categorías' })
  list(@Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.list(query.parentId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Ver el detalle de una categoría' })
  findById(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Crear una categoría (admin)' })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: JwtPayload) {
    return this.categoriesService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar una categoría (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: JwtPayload) {
    return this.categoriesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Desactivar una categoría (admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.categoriesService.remove(id, user.sub);
  }
}
