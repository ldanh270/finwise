export type LoanDirection = 'LENT' | 'BORROWED';

export interface LoanScheduleItem {
  readonly installment: number;
  readonly dueDate: string;
  readonly principalMinorUnits: bigint;
  readonly interestMinorUnits: bigint;
  readonly feeMinorUnits: bigint;
  readonly totalDueMinorUnits: bigint;
  readonly openingPrincipalMinorUnits: bigint;
  readonly closingPrincipalMinorUnits: bigint;
}

export interface PaymentAllocation {
  readonly feeMinorUnits: bigint;
  readonly interestMinorUnits: bigint;
  readonly principalMinorUnits: bigint;
  readonly unappliedMinorUnits: bigint;
}

export type InvestmentTradeSide = 'BUY' | 'SELL';

export interface InvestmentTrade {
  readonly instrumentId: string;
  readonly side: InvestmentTradeSide;
  /** Quantity in units scaled by quantityScale (for example 1_000_000). */
  readonly quantityUnits: bigint;
  readonly quantityScale: bigint;
  readonly totalCostMinorUnits: bigint;
}

export interface PositionProjection {
  readonly instrumentId: string;
  readonly quantityUnits: bigint;
  readonly quantityScale: bigint;
  readonly costBasisMinorUnits: bigint;
  readonly realizedGainMinorUnits: bigint;
}

export interface ValuationProjection extends PositionProjection {
  readonly marketValueMinorUnits: bigint;
  readonly unrealizedGainMinorUnits: bigint;
}
