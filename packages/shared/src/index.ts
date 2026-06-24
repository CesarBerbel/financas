export const SUPPORTED_CURRENCIES = ['BRL', 'EUR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const FINANCIAL_PROFILE_TYPES = ['PERSONAL_BRAZIL', 'PERSONAL_PORTUGAL', 'BUSINESS_PORTUGAL'] as const;
export type FinancialProfileType = (typeof FINANCIAL_PROFILE_TYPES)[number];

export const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'WALLET', 'INVESTMENT', 'BUSINESS', 'RESERVE'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'ARCHIVED', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const defaultProfiles = [
  { type: 'PERSONAL_BRAZIL', name: 'Pessoal Brasil', baseCurrency: 'BRL' },
  { type: 'PERSONAL_PORTUGAL', name: 'Pessoal Portugal', baseCurrency: 'EUR' },
  { type: 'BUSINESS_PORTUGAL', name: 'Empresa Portugal', baseCurrency: 'EUR' }
] as const;
