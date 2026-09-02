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
  WealthCommandContext,
  WealthCommandRecord,
} from './wealth.ports';

export class WealthService {
  constructor(private readonly store: WealthStorePort) {}

  createLoan(
    workspaceId: string,
    input: CreateLoanInput,
    command?: WealthCommandContext,
  ): LoanContractRecord {
    requireWorkspaceId(workspaceId);
    const replay = this.replay<LoanContractRecord>(
      workspaceId,
      command,
      'loan.create',
    );
    if (replay) return replay;
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
    const contract = this.store.createLoan({
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
    this.remember(workspaceId, command, 'loan.create', contract);
    return contract;
  }

  listLoans(workspaceId: string): readonly LoanContractRecord[] {
    requireWorkspaceId(workspaceId);
    return this.store.listLoans(workspaceId);
  }

  recordLoanPayment(
    workspaceId: string,
    input: RecordLoanPaymentInput,
    command?: WealthCommandContext,
  ): LoanPaymentRecord {
    const replay = this.replay<LoanPaymentRecord>(
      workspaceId,
      command,
      'loan.payment',
    );
    if (replay) return replay;
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
    const payment = this.store.addLoanPayment({
      id: this.store.nextId('loan-payment'),
      workspaceId,
      contractId: contract.id,
      installment: input.installment,
      amountMinorUnits: input.amountMinorUnits,
      effectiveDate: input.effectiveDate,
      allocation,
    });
    this.remember(workspaceId, command, 'loan.payment', payment);
    return payment;
  }

  listLoanPayments(
    workspaceId: string,
    contractId: string,
  ): readonly LoanPaymentRecord[] {
    requireWorkspaceId(workspaceId);
    return this.store.listLoanPayments(workspaceId, contractId);
  }

  recordInvestmentTrade(
    workspaceId: string,
    input: RecordInvestmentTradeInput,
    command?: WealthCommandContext,
  ): {
    readonly trade: InvestmentTradeRecord;
    readonly positions: readonly ReturnType<typeof projectPositions>[number][];
  } {
    requireWorkspaceId(workspaceId);
    const replay = this.replay<{
      readonly trade: InvestmentTradeRecord;
      readonly positions: readonly ReturnType<
        typeof projectPositions
      >[number][];
    }>(workspaceId, command, 'investment.trade');
    if (replay) return replay;
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
    const result = { trade: this.store.addInvestmentTrade(trade), positions };
    this.remember(workspaceId, command, 'investment.trade', result);
    return result;
  }

  recordInvestmentValuation(
    workspaceId: string,
    input: RecordInvestmentValuationInput,
    command?: WealthCommandContext,
  ): InvestmentValuationRecord {
    const replay = this.replay<InvestmentValuationRecord>(
      workspaceId,
      command,
      'investment.valuation',
    );
    if (replay) return replay;
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
    const result = this.store.addInvestmentValuation(valuation);
    this.remember(workspaceId, command, 'investment.valuation', result);
    return result;
  }

  listInvestmentPositions(workspaceId: string) {
    requireWorkspaceId(workspaceId);
    return projectPositions(this.store.listInvestmentTrades(workspaceId));
  }

  listInvestmentValuations(
    workspaceId: string,
    instrumentId?: string,
  ): readonly InvestmentValuationRecord[] {
    requireWorkspaceId(workspaceId);
    return this.store.listInvestmentValuations(workspaceId, instrumentId);
  }

  private replay<T>(
    workspaceId: string,
    command: WealthCommandContext | undefined,
    operation: string,
  ): T | undefined {
    if (!command) return undefined;
    const existing = this.store.findCommand(
      workspaceId,
      command.key,
      operation,
    );
    if (!existing) return undefined;
    if (existing.requestHash !== command.requestHash) {
      throw FinwiseError.conflict(
        'Idempotency key was already used for another request.',
      );
    }
    return existing.response as T;
  }

  private remember<T>(
    workspaceId: string,
    command: WealthCommandContext | undefined,
    operation: string,
    response: T,
  ): void {
    if (!command) return;
    const record: WealthCommandRecord = {
      workspaceId,
      key: command.key,
      operation,
      requestHash: command.requestHash,
      response,
    };
    this.store.saveCommand(record);
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
