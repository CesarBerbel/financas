"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultProfiles = exports.ACCOUNT_STATUSES = exports.ACCOUNT_TYPES = exports.FINANCIAL_PROFILE_TYPES = exports.SUPPORTED_CURRENCIES = void 0;
exports.SUPPORTED_CURRENCIES = ['BRL', 'EUR'];
exports.FINANCIAL_PROFILE_TYPES = ['PERSONAL_BRAZIL', 'PERSONAL_PORTUGAL', 'BUSINESS_PORTUGAL'];
exports.ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'WALLET', 'INVESTMENT', 'BUSINESS', 'RESERVE'];
exports.ACCOUNT_STATUSES = ['ACTIVE', 'ARCHIVED', 'CLOSED'];
exports.defaultProfiles = [
    { type: 'PERSONAL_BRAZIL', name: 'Pessoal Brasil', baseCurrency: 'BRL' },
    { type: 'PERSONAL_PORTUGAL', name: 'Pessoal Portugal', baseCurrency: 'EUR' },
    { type: 'BUSINESS_PORTUGAL', name: 'Empresa Portugal', baseCurrency: 'EUR' }
];
//# sourceMappingURL=index.js.map