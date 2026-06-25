import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @IsOptional()
  @IsString()
  financialProfileId?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  @Length(2, 80)
  name!: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  financialProfileId?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;
}

export type CategoryListFilters = {
  financialProfileId?: string;
  q?: string;
};

export class CategoryReportQueryDto {
  @IsOptional()
  @IsString()
  financialProfileId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
