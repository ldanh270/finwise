import { FinwiseError } from '../../shared/errors/finwise-error';
import {
  InvestmentTradeRecord,
  InvestmentValuationRecord,
  LoanContractRecord,
  LoanPaymentRecord,
  WealthStorePort,
} from '../application/wealth.ports';

export class InMemoryWealthStore implements WealthStorePort {
  private readonly loans = new Map<string, LoanContractRecord>();
  private readonly payments = new Map<string, LoanPaymentRecord>();
  private readonly trades = new Map<string, InvestmentTradeRecord>();
  private readonly valuations = new Map<string, InvestmentValuationRecord>();
  private sequence = 0;

  createLoan(contract: LoanContractRecord): LoanContractRecord {
    this.loans.set(contract.id, contract);
    return contract;
  }

  getLoan(workspaceId: string, contractId: string): LoanContractRecord {
    const contract = this.loans.get(contractId);
    if (!contract || contract.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Loan contract');
    }
    return contract;
  }

  listLoans(workspaceId: string): readonly LoanContractRecord[] {
    return [...this.loans.values()].filter(
      (contract) => contract.workspaceId === workspaceId,
    );
  }

  addLoanPayment(payment: LoanPaymentRecord): LoanPaymentRecord {
    this.getLoan(payment.workspaceId, payment.contractId);
    this.payments.set(payment.id, payment);
    return payment;
  }

  listLoanPayments(
    workspaceId: string,
    contractId: string,
  ): readonly LoanPaymentRecord[] {
    this.getLoan(workspaceId, contractId);
    return [...this.payments.values()].filter(
      (payment) =>
        payment.workspaceId === workspaceId &&
        payment.contractId === contractId,
    );
  }

  addInvestmentTrade(trade: InvestmentTradeRecord): InvestmentTradeRecord {
    this.trades.set(trade.id, trade);
    return trade;
  }

  listInvestmentTrades(workspaceId: string): readonly InvestmentTradeRecord[] {
    return [...this.trades.values()].filter(
      (trade) => trade.workspaceId === workspaceId,
    );
  }

  addInvestmentValuation(
    valuation: InvestmentValuationRecord,
  ): InvestmentValuationRecord {
    this.valuations.set(valuation.id, valuation);
    return valuation;
  }

  listInvestmentValuations(
    workspaceId: string,
    instrumentId?: string,
  ): readonly InvestmentValuationRecord[] {
    return [...this.valuations.values()].filter(
      (valuation) =>
        valuation.workspaceId === workspaceId &&
        (instrumentId === undefined || valuation.instrumentId === instrumentId),
    );
  }

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }
}
