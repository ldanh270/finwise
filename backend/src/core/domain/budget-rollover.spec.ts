import { calculateBudgetRollover } from './budget-rollover';

describe('calculateBudgetRollover', () => {
  it('does not carry when rollover is disabled', () => {
    expect(
      calculateBudgetRollover({
        allocatedMinorUnits: 100n,
        actualMinorUnits: 40n,
        mode: 'NONE',
      }),
    ).toEqual({ closingBalanceMinorUnits: 60n, carryMinorUnits: 0n });
  });

  it('carries only positive balances for POSITIVE_ONLY', () => {
    expect(
      calculateBudgetRollover({
        allocatedMinorUnits: 100n,
        actualMinorUnits: 140n,
        mode: 'POSITIVE_ONLY',
      }),
    ).toEqual({ closingBalanceMinorUnits: -40n, carryMinorUnits: 0n });
  });

  it('preserves a negative balance for FULL_BALANCE', () => {
    expect(
      calculateBudgetRollover({
        allocatedMinorUnits: 100n,
        actualMinorUnits: 140n,
        mode: 'FULL_BALANCE',
      }),
    ).toEqual({ closingBalanceMinorUnits: -40n, carryMinorUnits: -40n });
  });
});
