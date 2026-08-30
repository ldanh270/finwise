import { FinwiseError } from '../errors/finwise-error';

export const MVP_CURRENCY = 'VND' as const;
export type SupportedCurrency = typeof MVP_CURRENCY;

const MINOR_UNIT_PATTERN = /^(0|[1-9][0-9]*)$/;

/** Exact, non-negative VND minor units. Financial inputs never pass through Number. */
export class Money {
  private constructor(
    readonly currency: SupportedCurrency,
    readonly minorUnits: bigint,
  ) {}

  static fromMinorUnits(value: string, currency: string = MVP_CURRENCY): Money {
    if (currency !== MVP_CURRENCY) {
      throw FinwiseError.validation('Only VND is supported by the MVP.', {
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
    return new Money(MVP_CURRENCY, minorUnits);
  }

  static fromBigInt(value: bigint): Money {
    if (value <= 0n) {
      throw FinwiseError.validation('Amount must be greater than zero.');
    }
    return new Money(MVP_CURRENCY, value);
  }

  toMinorUnitsString(): string {
    return this.minorUnits.toString();
  }
}

export function signedMinorUnits(amount: bigint, increase: boolean): bigint {
  return increase ? amount : -amount;
}
