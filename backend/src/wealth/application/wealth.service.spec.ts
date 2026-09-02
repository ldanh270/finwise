import { InMemoryWealthStore } from '../infrastructure/in-memory-wealth.store';
import { WealthService } from './wealth.service';

describe('WealthService', () => {
  it('stores version-one loan schedules and allocates partial payments in order', () => {
    const service = new WealthService(new InMemoryWealthStore());
    const contract = service.createLoan('workspace-1', {
      direction: 'LENT',
      principalMinorUnits: 100n,
      termMonths: 2,
      firstDueDate: '2026-08-31',
      feeMinorUnits: 2n,
      scheduleMode: 'INTEREST_FREE',
    });
    expect(contract.scheduleVersion).toBe(1);
    const first = service.recordLoanPayment('workspace-1', {
      contractId: contract.id,
      installment: 1,
      amountMinorUnits: 20n,
      effectiveDate: '2026-09-01',
    });
    expect(first.allocation).toEqual({
      feeMinorUnits: 2n,
      interestMinorUnits: 0n,
      principalMinorUnits: 18n,
      unappliedMinorUnits: 0n,
    });
    const second = service.recordLoanPayment('workspace-1', {
      contractId: contract.id,
      installment: 1,
      amountMinorUnits: 100n,
      effectiveDate: '2026-09-02',
    });
    expect(second.allocation.principalMinorUnits).toBe(32n);
    expect(second.allocation.unappliedMinorUnits).toBe(68n);
  });

  it('keeps investment valuation separate from trade projections and tenants', () => {
    const service = new WealthService(new InMemoryWealthStore());
    service.recordInvestmentTrade('workspace-1', {
      instrumentId: 'fund-1',
      side: 'BUY',
      quantityUnits: 2n,
      quantityScale: 1n,
      totalCostMinorUnits: 200n,
      tradedAt: '2026-08-31',
    });
    const result = service.recordInvestmentTrade('workspace-1', {
      instrumentId: 'fund-1',
      side: 'BUY',
      quantityUnits: 1n,
      quantityScale: 1n,
      totalCostMinorUnits: 100n,
      tradedAt: '2026-09-01',
    });
    expect(result.positions[0]?.costBasisMinorUnits).toBe(300n);
    const valuation = service.recordInvestmentValuation('workspace-1', {
      instrumentId: 'fund-1',
      valuedAt: '2026-09-02',
      marketPriceMinorUnits: 150n,
    });
    expect(valuation.projection.marketValueMinorUnits).toBe(450n);
    expect(service.listInvestmentPositions('workspace-2')).toEqual([]);
  });

  it('replays an idempotent command and rejects key reuse with a different payload', () => {
    const service = new WealthService(new InMemoryWealthStore());
    const input = {
      direction: 'LENT' as const,
      scheduleMode: 'INTEREST_FREE' as const,
      principalMinorUnits: 100n,
      termMonths: 1,
      firstDueDate: '2026-09-01',
    };
    const command = { key: 'loan-1', requestHash: 'hash-a' };
    const first = service.createLoan('workspace-1', input, command);
    const replay = service.createLoan('workspace-1', input, command);

    expect(replay).toEqual(first);
    expect(() =>
      service.createLoan(
        'workspace-1',
        { ...input, principalMinorUnits: 101n },
        { ...command, requestHash: 'hash-b' },
      ),
    ).toThrow('Idempotency key');
  });
});
