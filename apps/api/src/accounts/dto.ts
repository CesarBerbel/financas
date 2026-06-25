import { AccountStatus, AccountType } from '@prisma/client';
import { IsDecimal, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

const supportedCurrencies = ['BRL', 'EUR', 'USD'] as const;

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  financialProfileId!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsIn(supportedCurrencies)
  currencyCode!: 'BRL' | 'EUR' | 'USD';

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  initialBalance?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string;
}
