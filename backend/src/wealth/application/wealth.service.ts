import {
  addValuation,
  buildInterestFreeSchedule,
  buildReducingBalanceSchedule,
  allocatePayment,
  projectPositions,
} from '../domain';
import { FinwiseError } from '../../shared/errors/finwise-error';
import {
  CreateLoanInput,
  InvestmentTradeRecord,
  LoanContractRecord,
  LoanPaymentRecord,
  RecordInvestmentTradeInput,
  RecordInvestmentValuationInput,
  RecordLoanPaymentInput,
  WealthStorePort,
  InvestmentValuationRecord,
} from './wealth.ports';

export class WealthService {
  constructor(private readonly store: WealthStorePort) {}

  createLoan(workspaceId: string, input: CreateLoanInput): LoanContractRecord {
    requireWorkspaceId(workspaceId);
    const annualRateBasisPoints = input.annualRateBasisPoints ?? 0n;
    const feeMinorUnits = input.feeMinorUnits ?? 0n;
    const schedule =
      input.scheduleMode === 'INTEREST_FREE'
        ? buildInterestFreeSchedule(
            input.principalMinorUnits,
            input.termMonths,
            input.firstDueDate,
            feeMinorUnits,
          )
        : buildReducingBalanceSchedule(
            input.principalMinorUnits,
            annualRateBasisPoints,
            input.termMonths,
            input.firstDueDate,
            feeMinorUnits,
          );
    return this.store.createLoan({
      id: this.store.nextId('loan'),
      workspaceId,
      direction: input.direction,
      principalMinorUnits: input.principalMinorUnits,
      annualRateBasisPoints,
      termMonths: input.termMonths,
      firstDueDate: input.firstDueDate,
      feeMinorUnits,
      scheduleVersion: 1,
      schedule,
    });
  }

  recordLoanPayment(
    workspaceId: string,
    input: RecordLoanPaymentInput,
  ): LoanPaymentRecord {
    const contract = this.store.getLoan(workspaceId, input.contractId);
    const due = contract.schedule.find(
      (item) => item.installment === input.installment,
    );
    if (!due) throw FinwiseError.notFound('Loan installment');
    if (input.amountMinorUnits < 0n) {
      throw FinwiseError.validation('Payment amount must not be negative.', {
        field: 'amountMinorUnits',
      });
    }
    const paid = this.store
      .listLoanPayments(workspaceId, contract.id)
      .filter((payment) => payment.installment === input.installment)
      .reduce(
        (total, payment) => addAllocations(total, payment.allocation),
        emptyAllocation(),
      );
    const allocation = allocatePayment(
      input.amountMinorUnits,
      due.feeMinorUnits - paid.feeMinorUnits,
      due.interestMinorUnits - paid.interestMinorUnits,
      due.principalMinorUnits - paid.principalMinorUnits,
    );
    return this.store.addLoanPayment({
      id: this.store.nextId('loan-payment'),
      workspaceId,
      contractId: contract.id,
      installment: input.installment,
      amountMinorUnits: input.amountMinorUnits,
      effectiveDate: input.effectiveDate,
      allocation,
    });
  }

  recordInvestmentTrade(
    workspaceId: string,
    input: RecordInvestmentTradeInput,
  ): {
    readonly trade: InvestmentTradeRecord;
    readonly positions: readonly ReturnType<typeof projectPositions>[number][];
  } {
    requireWorkspaceId(workspaceId);
    const trade: InvestmentTradeRecord = {
      id: this.store.nextId('trade'),
      workspaceId,
      instrumentId: input.instrumentId,
      side: input.side,
      quantityUnits: input.quantityUnits,
      quantityScale: input.quantityScale,
      totalCostMinorUnits: input.totalCostMinorUnits,
      tradedAt: input.tradedAt,
    };
    const positions = projectPositions([
      ...this.store.listInvestmentTrades(workspaceId),
      trade,
    ]);
    return { trade: this.store.addInvestmentTrade(trade), positions };
  }

  recordInvestmentValuation(
    workspaceId: string,
    input: RecordInvestmentValuationInput,
  ): InvestmentValuationRecord {
    const position = projectPositions(
      this.store
        .listInvestmentTrades(workspaceId)
        .filter((trade) => trade.instrumentId === input.instrumentId),
    ).find((candidate) => candidate.instrumentId === input.instrumentId);
    if (!position) throw FinwiseError.notFound('Investment position');
    const valuation = {
      id: this.store.nextId('valuation'),
      workspaceId,
      instrumentId: input.instrumentId,
      valuedAt: input.valuedAt,
      marketPriceMinorUnits: input.marketPriceMinorUnits,
      projection: addValuation(position, input.marketPriceMinorUnits),
    };
    return this.store.addInvestmentValuation(valuation);
  }

  listInvestmentPositions(workspaceId: string) {
    return projectPositions(this.store.listInvestmentTrades(workspaceId));
  }
}

function requireWorkspaceId(workspaceId: string): void {
  if (!workspaceId.trim()) {
    throw FinwiseError.validation('workspaceId is required.');
  }
}

function emptyAllocation() {
  return {
    feeMinorUnits: 0n,
    interestMinorUnits: 0n,
    principalMinorUnits: 0n,
    unappliedMinorUnits: 0n,
  };
}

function addAllocations(
  left: ReturnType<typeof emptyAllocation>,
  right: ReturnType<typeof emptyAllocation>,
) {
  return {
    feeMinorUnits: left.feeMinorUnits + right.feeMinorUnits,
    interestMinorUnits: left.interestMinorUnits + right.interestMinorUnits,
    principalMinorUnits: left.principalMinorUnits + right.principalMinorUnits,
    unappliedMinorUnits: left.unappliedMinorUnits + right.unappliedMinorUnits,
  };
}
