import { FinancialProfileType } from '@prisma/client';
import { IsEnum, IsIn, IsString, MinLength } from 'class-validator';

export class CreateFinancialProfileDto {
  @IsString() @MinLength(2) name!: string;
  @IsEnum(FinancialProfileType) type!: FinancialProfileType;
  @IsIn(['BRL', 'EUR']) baseCurrency!: 'BRL' | 'EUR';
}
