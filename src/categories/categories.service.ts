import {
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  badRequestBusinessError,
  notFoundBusinessError,
} from '../common/errors/business-error';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const normalizedName = dto.name.trim();

    const existing = await this.prisma.category.findUnique({
      where: { name: normalizedName },
    });

    if (existing) {
      throw badRequestBusinessError(
        'CATEGORY_DUPLICATE',
        'Category name already exists.',
      );
    }

    return this.prisma.category.create({
      data: {
        name: normalizedName,
        description: dto.description?.trim(),
      },
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(categoryId: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      throw notFoundBusinessError('CATEGORY_NOT_FOUND', 'Category not found.');
    }

    const normalizedName = dto.name?.trim();

    if (normalizedName && normalizedName !== existing.name) {
      const duplicateName = await this.prisma.category.findUnique({
        where: { name: normalizedName },
      });
      if (duplicateName) {
        throw badRequestBusinessError(
          'CATEGORY_DUPLICATE',
          'Category name already exists.',
        );
      }
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: normalizedName,
        description: dto.description?.trim(),
      },
    });
  }

  async remove(categoryId: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            physiotherapists: true,
          },
        },
      },
    });

    if (!existing) {
      throw notFoundBusinessError('CATEGORY_NOT_FOUND', 'Category not found.');
    }

    if (existing._count.physiotherapists > 0) {
      throw badRequestBusinessError(
        'CATEGORY_IN_USE',
        'Category is still used by physiotherapists and cannot be deleted.',
      );
    }

    await this.prisma.category.delete({ where: { id: categoryId } });
    return { message: 'Category deleted successfully.' };
  }
}
