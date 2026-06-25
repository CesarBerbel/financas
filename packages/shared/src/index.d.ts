export declare const SUPPORTED_CURRENCIES: readonly ["BRL", "EUR"];
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export declare const FINANCIAL_PROFILE_TYPES: readonly ["PERSONAL_BRAZIL", "PERSONAL_PORTUGAL", "BUSINESS_PORTUGAL"];
export type FinancialProfileType = (typeof FINANCIAL_PROFILE_TYPES)[number];
export declare const ACCOUNT_TYPES: readonly ["CHECKING", "SAVINGS", "WALLET", "INVESTMENT", "BUSINESS", "RESERVE"];
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export declare const ACCOUNT_STATUSES: readonly ["ACTIVE", "ARCHIVED", "CLOSED"];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export declare const defaultProfiles: readonly [{
    readonly type: "PERSONAL_BRAZIL";
    readonly name: "Pessoal Brasil";
    readonly baseCurrency: "BRL";
}, {
    readonly type: "PERSONAL_PORTUGAL";
    readonly name: "Pessoal Portugal";
    readonly baseCurrency: "EUR";
}, {
    readonly type: "BUSINESS_PORTUGAL";
    readonly name: "Empresa Portugal";
    readonly baseCurrency: "EUR";
}];
