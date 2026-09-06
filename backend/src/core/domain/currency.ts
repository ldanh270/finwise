export const CURRENCY_CODES = [
  'VND',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'KRW',
  'CNY',
  'SGD',
  'THB',
  'AUD',
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export interface CurrencyMetadata {
  readonly code: CurrencyCode;
  readonly symbol: string;
  readonly scale: 0 | 2;
}

const METADATA: Readonly<Record<CurrencyCode, CurrencyMetadata>> = {
  VND: { code: 'VND', symbol: '₫', scale: 0 },
  USD: { code: 'USD', symbol: '$', scale: 2 },
  EUR: { code: 'EUR', symbol: '€', scale: 2 },
  GBP: { code: 'GBP', symbol: '£', scale: 2 },
  JPY: { code: 'JPY', symbol: '¥', scale: 0 },
  KRW: { code: 'KRW', symbol: '₩', scale: 0 },
  CNY: { code: 'CNY', symbol: '¥', scale: 2 },
  SGD: { code: 'SGD', symbol: 'S$', scale: 2 },
  THB: { code: 'THB', symbol: '฿', scale: 2 },
  AUD: { code: 'AUD', symbol: 'A$', scale: 2 },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    typeof value === 'string' &&
    (CURRENCY_CODES as readonly string[]).includes(value)
  );
}

export function currencyMetadata(code: CurrencyCode): CurrencyMetadata {
  return METADATA[code];
}
