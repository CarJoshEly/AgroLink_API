import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database';
import { generateSlug } from '../common/utils';
import { AuditLogService } from '../audit';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  list(parentId?: string, includeInactive = false) {
    return this.prisma.category.findMany({
      where: {
        ...(parentId ? { parentId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
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

  async create(dto: CreateCategoryDto, adminId: string) {
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: generateSlug(dto.name),
        parentId: dto.parentId,
        isActive: dto.isActive ?? true,
      },
    });
    await this.auditLogService.log(adminId, 'CATEGORY_CREATED', 'Category', category.id, undefined, category);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, adminId: string) {
    const previous = await this.findById(id);
    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name, slug: generateSlug(dto.name) } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.auditLogService.log(adminId, 'CATEGORY_UPDATED', 'Category', id, previous, updated);
    return updated;
  }

  async remove(id: string, adminId: string) {
    await this.findById(id);
    await this.prisma.category.update({ where: { id }, data: { isActive: false } });
    await this.auditLogService.log(adminId, 'CATEGORY_DEACTIVATED', 'Category', id, { isActive: true }, { isActive: false });
    return { message: 'Categoría desactivada' };
  }
}
