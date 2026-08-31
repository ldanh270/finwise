import {
  allocatePayment,
  buildInterestFreeSchedule,
  buildReducingBalanceSchedule,
} from './loan-calculator';
import { addValuation, projectPositions } from './investment-calculator';

describe('wealth domain calculators', () => {
  it('builds interest-free schedules with an exact final remainder', () => {
    const schedule = buildInterestFreeSchedule(100n, 3, '2026-08-31');
    expect(schedule.map((item) => item.principalMinorUnits)).toEqual([
      33n,
      33n,
      34n,
    ]);
    expect(schedule.at(-1)?.closingPrincipalMinorUnits).toBe(0n);
  });

  it('uses reducing-balance interest and fee-interest-principal allocation', () => {
    const schedule = buildReducingBalanceSchedule(
      120_000n,
      1_200n,
      2,
      '2026-08-31',
    );
    expect(schedule[0]?.interestMinorUnits).toBe(1_200n);
    expect(schedule[1]?.interestMinorUnits).toBe(600n);
    expect(allocatePayment(12n, 2n, 5n, 10n)).toEqual({
      feeMinorUnits: 2n,
      interestMinorUnits: 5n,
      principalMinorUnits: 5n,
      unappliedMinorUnits: 0n,
    });
  });

  it('projects weighted-average cost and keeps valuation outside cash flow', () => {
    const position = projectPositions([
      {
        instrumentId: 'fund-1',
        side: 'BUY',
        quantityUnits: 2n,
        quantityScale: 1n,
        totalCostMinorUnits: 200n,
      },
      {
        instrumentId: 'fund-1',
        side: 'BUY',
        quantityUnits: 1n,
        quantityScale: 1n,
        totalCostMinorUnits: 100n,
      },
      {
        instrumentId: 'fund-1',
        side: 'SELL',
        quantityUnits: 1n,
        quantityScale: 1n,
        totalCostMinorUnits: 150n,
      },
    ])[0];
    if (!position) throw new Error('expected a position projection');
    expect(position.costBasisMinorUnits).toBe(200n);
    expect(position.realizedGainMinorUnits).toBe(50n);
    expect(addValuation(position, 150n).unrealizedGainMinorUnits).toBe(100n);
  });
});
