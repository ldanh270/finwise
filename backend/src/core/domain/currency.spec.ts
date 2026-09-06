import { currencyMetadata, isCurrencyCode } from './currency';

describe('currency metadata', () => {
  it('accepts only the supported MVP currency codes', () => {
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('VND')).toBe(true);
    expect(isCurrencyCode('BTC')).toBe(false);
  });

  it('returns display metadata and minor-unit scale', () => {
    expect(currencyMetadata('VND')).toMatchObject({ code: 'VND', scale: 0 });
    expect(currencyMetadata('USD')).toMatchObject({ code: 'USD', scale: 2 });
    expect(currencyMetadata('JPY')).toMatchObject({ code: 'JPY', scale: 0 });
  });
});
