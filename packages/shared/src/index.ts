export const SUPPORTED_CURRENCIES = ['BRL', 'EUR', 'USD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const FINANCIAL_PROFILE_TYPES = ['PERSONAL_BRAZIL', 'PERSONAL_PORTUGAL', 'BUSINESS_PORTUGAL', 'BUSINESS_USA'] as const;
export type FinancialProfileType = (typeof FINANCIAL_PROFILE_TYPES)[number];

export const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'WALLET', 'INVESTMENT', 'BUSINESS', 'RESERVE'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'ARCHIVED', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const defaultProfiles = [
  { type: 'PERSONAL_BRAZIL', name: 'Pessoal Brasil', baseCurrency: 'BRL' },
  { type: 'PERSONAL_PORTUGAL', name: 'Pessoal Portugal', baseCurrency: 'EUR' },
  { type: 'BUSINESS_PORTUGAL', name: 'Empresa Portugal', baseCurrency: 'EUR' },
  { type: 'BUSINESS_USA', name: 'Empresa USA', baseCurrency: 'USD' }
] as const;

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const DEFAULT_CATEGORY_NAMES_BY_PROFILE_TYPE = {
  PERSONAL_BRAZIL: ['Moradia', 'Alimentação', 'Transporte'],
  PERSONAL_PORTUGAL: ['Moradia', 'Alimentação', 'Transporte', 'IVA', 'Segurança Social'],
  BUSINESS_PORTUGAL: ['Contabilidade', 'Impostos', 'Software', 'IVA', 'Segurança Social'],
  BUSINESS_USA: ['Contabilidade', 'Impostos', 'Software'],
} as const;
