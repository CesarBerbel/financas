const currencySymbols: Record<string, string> = {
  BRL: 'R$',
  EUR: '€',
  USD: 'US$',
};

export function getCurrencySymbol(currencyCode?: string) {
  return currencySymbols[currencyCode ?? ''] ?? currencyCode ?? '';
}

export function moneyInputPlaceholder(currencyCode?: string) {
  const symbol = getCurrencySymbol(currencyCode);
  return symbol ? `${symbol} 0,00` : '0,00';
}

export function parseMoneyInputToDecimal(input: string) {
  const isNegative = input.includes('-');
  const digits = input.replace(/\D/g, '');

  if (!digits) return isNegative ? '-' : '';

  const paddedDigits = digits.padStart(3, '0');
  const integerPart = paddedDigits.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  const decimalPart = paddedDigits.slice(-2);

  return `${isNegative ? '-' : ''}${integerPart}.${decimalPart}`;
}

export function formatMoneyInput(value: string, currencyCode?: string) {
  if (!value) return '';
  if (value === '-') return '-';

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '';

  const symbol = getCurrencySymbol(currencyCode);
  const absoluteValue = Math.abs(numericValue);
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absoluteValue);

  return `${numericValue < 0 ? '-' : ''}${symbol ? `${symbol} ` : ''}${formattedValue}`;
}
