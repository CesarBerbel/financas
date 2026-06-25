import { FinancialProfileStatus, FinancialProfileType } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFinancialProfileDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(FinancialProfileType)
  type!: FinancialProfileType;

  @IsIn(['BRL', 'EUR', 'USD'])
  baseCurrency!: 'BRL' | 'EUR' | 'USD';
}

export class UpdateFinancialProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(FinancialProfileType)
  type?: FinancialProfileType;

  @IsOptional()
  @IsIn(['BRL', 'EUR', 'USD'])
  baseCurrency?: 'BRL' | 'EUR' | 'USD';

  @IsOptional()
  @IsEnum(FinancialProfileStatus)
  status?: FinancialProfileStatus;
}
