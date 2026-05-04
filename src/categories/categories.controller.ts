import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Shared list endpoint for all authenticated users.
  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/categories')
  @ApiOperation({ summary: 'Create category (admin)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/categories/:categoryId')
  @ApiOperation({ summary: 'Update category (admin)' })
  update(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(categoryId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('admin/categories/:categoryId')
  @ApiOperation({ summary: 'Delete category (admin)' })
  remove(@Param('categoryId') categoryId: string) {
    return this.categoriesService.remove(categoryId);
  }
}
