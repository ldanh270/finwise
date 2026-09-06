import { FinwiseError } from '../errors/finwise-error';
import { CurrencyCode, isCurrencyCode } from '../../core/domain/currency';

export const MVP_CURRENCY = 'VND' as const;
export type SupportedCurrency = CurrencyCode;

const MINOR_UNIT_PATTERN = /^(0|[1-9][0-9]*)$/;

/** Exact, non-negative minor units. Financial inputs never pass through Number. */
export class Money {
  private constructor(
    readonly currency: SupportedCurrency,
    readonly minorUnits: bigint,
  ) {}

  static fromMinorUnits(value: string, currency: string = MVP_CURRENCY): Money {
    if (!isCurrencyCode(currency)) {
      throw FinwiseError.validation('Currency is not supported by the MVP.', {
        field: 'currency',
      });
    }
    if (!MINOR_UNIT_PATTERN.test(value)) {
      throw FinwiseError.validation(
        'Amount must be a non-negative integer minor-unit string.',
        { field: 'minorUnits' },
      );
    }
    const minorUnits = BigInt(value);
    if (minorUnits <= 0n) {
      throw FinwiseError.validation('Amount must be greater than zero.', {
        field: 'minorUnits',
      });
    }
    return new Money(currency, minorUnits);
  }

  static fromBigInt(
    value: bigint,
    currency: CurrencyCode = MVP_CURRENCY,
  ): Money {
    if (value <= 0n) {
      throw FinwiseError.validation('Amount must be greater than zero.');
    }
    return new Money(currency, value);
  }

  toMinorUnitsString(): string {
    return this.minorUnits.toString();
  }
}

export function signedMinorUnits(amount: bigint, increase: boolean): bigint {
  return increase ? amount : -amount;
}
