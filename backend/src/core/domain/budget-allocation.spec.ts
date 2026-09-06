import { calculateBudgetAllocations } from './budget-allocation';

describe('calculateBudgetAllocations', () => {
  const depth: Record<string, number> = { parent: 0, childA: 1, childB: 1 };
  const isWithin = (budgetId: string, ancestorId: string): boolean =>
    budgetId === ancestorId ||
    (ancestorId === 'parent' &&
      (budgetId === 'childA' || budgetId === 'childB'));

  it('derives a BY_CHILDREN parent once without double-counting children', () => {
    const allocations = calculateBudgetAllocations(
      1_000_000n,
      [
        {
          id: 'parent-budget',
          budgetId: 'parent',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 0n,
          percentageBasisPoints: 0,
        },
        {
          id: 'child-a-budget',
          budgetId: 'childA',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 300_000n,
          percentageBasisPoints: 0,
        },
        {
          id: 'child-b-budget',
          budgetId: 'childB',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 200_000n,
          percentageBasisPoints: 0,
        },
      ],
      isWithin,
      (budgetId) => depth[budgetId] ?? 0,
    );

    expect(allocations).toEqual([
      {
        constraintId: 'parent-budget',
        allocatedMinorUnits: 500_000n,
        contributesToTotals: true,
      },
      {
        constraintId: 'child-a-budget',
        allocatedMinorUnits: 300_000n,
        contributesToTotals: false,
      },
      {
        constraintId: 'child-b-budget',
        allocatedMinorUnits: 200_000n,
        contributesToTotals: false,
      },
    ]);
  });

  it('uses the fixed allocation before percentage guardrails', () => {
    const allocations = calculateBudgetAllocations(
      1_000_000n,
      [
        {
          id: 'fixed',
          budgetId: 'childA',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 200_000n,
          percentageBasisPoints: 0,
        },
        {
          id: 'percentage',
          budgetId: 'childB',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 0n,
          percentageBasisPoints: 5000,
        },
      ],
      isWithin,
      (budgetId) => depth[budgetId] ?? 0,
    );

    expect(
      allocations.map((allocation) => allocation.allocatedMinorUnits),
    ).toEqual([200_000n, 400_000n]);
  });
});
