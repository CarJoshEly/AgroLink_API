import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database';
import { generateSlug } from '../common/utils';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(parentId?: string) {
    return this.prisma.category.findMany({
      where: parentId ? { parentId } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: generateSlug(dto.name),
        parentId: dto.parentId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name, slug: generateSlug(dto.name) } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.category.update({ where: { id }, data: { isActive: false } });
    return { message: 'Categoría desactivada' };
  }
}
