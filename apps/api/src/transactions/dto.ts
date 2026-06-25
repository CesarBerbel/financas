import { TransactionType } from '@prisma/client';
import { IsDateString, IsDecimal, IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  financialProfileId!: string;

  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsOptional()
  @IsString()
  destinationAccountId?: string;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsDecimal({ decimal_digits: '0,2' })
  amount!: string;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  @Length(2, 160)
  description!: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  notes?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  financialProfileId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accountId?: string;

  @IsOptional()
  @IsString()
  destinationAccountId?: string | null;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  amount?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @Length(2, 160)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  categoryName?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  notes?: string | null;
}

export type TransactionListFilters = {
  financialProfileId?: string;
  accountId?: string;
  categoryName?: string;
  dateFrom?: string;
  dateTo?: string;
};
