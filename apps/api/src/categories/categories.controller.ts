import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CategoryListFilters, CategoryReportQueryDto, CreateCategoryDto, UpdateCategoryDto } from './dto';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: CurrentUser, @Query() filters: CategoryListFilters) {
    return this.service.list(user.sub, filters);
  }

  @Get('report')
  report(@CurrentUser() user: CurrentUser, @Query() filters: CategoryReportQueryDto) {
    return this.service.report(user.sub, filters);
  }

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateCategoryDto) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return this.service.remove(user.sub, id);
  }
}
