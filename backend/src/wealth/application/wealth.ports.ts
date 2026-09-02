import {
  InvestmentTrade,
  LoanDirection,
  LoanScheduleItem,
  PaymentAllocation,
  ValuationProjection,
} from '../domain/wealth.types';

export interface LoanContractRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly direction: LoanDirection;
  readonly principalMinorUnits: bigint;
  readonly annualRateBasisPoints: bigint;
  readonly termMonths: number;
  readonly firstDueDate: string;
  readonly feeMinorUnits: bigint;
  readonly scheduleVersion: number;
  readonly schedule: readonly LoanScheduleItem[];
}

export interface LoanPaymentRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly contractId: string;
  readonly installment: number;
  readonly amountMinorUnits: bigint;
  readonly effectiveDate: string;
  readonly allocation: PaymentAllocation;
}

export interface InvestmentTradeRecord extends InvestmentTrade {
  readonly id: string;
  readonly workspaceId: string;
  readonly tradedAt: string;
}

export interface InvestmentValuationRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly instrumentId: string;
  readonly valuedAt: string;
  readonly marketPriceMinorUnits: bigint;
  readonly projection: ValuationProjection;
}

export interface WealthStorePort {
  createLoan(contract: LoanContractRecord): LoanContractRecord;
  getLoan(workspaceId: string, contractId: string): LoanContractRecord;
  listLoans(workspaceId: string): readonly LoanContractRecord[];
  addLoanPayment(payment: LoanPaymentRecord): LoanPaymentRecord;
  listLoanPayments(
    workspaceId: string,
    contractId: string,
  ): readonly LoanPaymentRecord[];
  addInvestmentTrade(trade: InvestmentTradeRecord): InvestmentTradeRecord;
  listInvestmentTrades(workspaceId: string): readonly InvestmentTradeRecord[];
  addInvestmentValuation(
    valuation: InvestmentValuationRecord,
  ): InvestmentValuationRecord;
  listInvestmentValuations(
    workspaceId: string,
    instrumentId?: string,
  ): readonly InvestmentValuationRecord[];
  findCommand(
    workspaceId: string,
    key: string,
    operation: string,
  ): WealthCommandRecord | undefined;
  saveCommand(command: WealthCommandRecord): void;
  nextId(prefix: string): string;
}

export interface WealthCommandRecord {
  readonly workspaceId: string;
  readonly key: string;
  readonly operation: string;
  readonly requestHash: string;
  readonly response: unknown;
}

export interface WealthCommandContext {
  readonly key: string;
  readonly requestHash: string;
}

export type LoanScheduleMode = 'INTEREST_FREE' | 'REDUCING_BALANCE';

export interface CreateLoanInput {
  readonly direction: LoanDirection;
  readonly principalMinorUnits: bigint;
  readonly annualRateBasisPoints?: bigint;
  readonly termMonths: number;
  readonly firstDueDate: string;
  readonly feeMinorUnits?: bigint;
  readonly scheduleMode: LoanScheduleMode;
}

export interface RecordLoanPaymentInput {
  readonly contractId: string;
  readonly installment: number;
  readonly amountMinorUnits: bigint;
  readonly effectiveDate: string;
}

export interface RecordInvestmentTradeInput {
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: bigint;
  readonly quantityScale: bigint;
  readonly totalCostMinorUnits: bigint;
  readonly tradedAt: string;
}

export interface RecordInvestmentValuationInput {
  readonly instrumentId: string;
  readonly valuedAt: string;
  readonly marketPriceMinorUnits: bigint;
}
