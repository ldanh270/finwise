import { calculateBudgetAllocations } from './budget-allocation';

describe('calculateBudgetAllocations', () => {
  const depth: Record<string, number> = { parent: 0, childA: 1, childB: 1 };
  const isWithin = (categoryId: string, ancestorId: string): boolean =>
    categoryId === ancestorId ||
    (ancestorId === 'parent' &&
      (categoryId === 'childA' || categoryId === 'childB'));

  it('derives a BY_CHILDREN parent once without double-counting children', () => {
    const allocations = calculateBudgetAllocations(
      1_000_000n,
      [
        {
          id: 'parent-budget',
          categoryId: 'parent',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 0n,
          percentageBasisPoints: 0,
        },
        {
          id: 'child-a-budget',
          categoryId: 'childA',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 300_000n,
          percentageBasisPoints: 0,
        },
        {
          id: 'child-b-budget',
          categoryId: 'childB',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 200_000n,
          percentageBasisPoints: 0,
        },
      ],
      isWithin,
      (categoryId) => depth[categoryId] ?? 0,
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
          categoryId: 'childA',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 200_000n,
          percentageBasisPoints: 0,
        },
        {
          id: 'percentage',
          categoryId: 'childB',
          mode: 'BY_CHILDREN',
          fixedMinorUnits: 0n,
          percentageBasisPoints: 5000,
        },
      ],
      isWithin,
      (categoryId) => depth[categoryId] ?? 0,
    );

    expect(
      allocations.map((allocation) => allocation.allocatedMinorUnits),
    ).toEqual([200_000n, 400_000n]);
  });
});
