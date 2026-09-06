import { BudgetConstraintMode } from './ledger.types';

export interface BudgetAllocationConstraint {
  readonly id: string;
  readonly budgetId: string;
  readonly mode: BudgetConstraintMode;
  readonly fixedMinorUnits: bigint;
  readonly percentageBasisPoints: number;
}

export interface BudgetAllocation {
  readonly constraintId: string;
  readonly allocatedMinorUnits: bigint;
  readonly contributesToTotals: boolean;
}

/**
 * Calculates recurring allocations without double-counting nested budget
 * constraints. Rollover is deliberately excluded from the percentage base.
 */
export function calculateBudgetAllocations(
  baseMinorUnits: bigint,
  constraints: readonly BudgetAllocationConstraint[],
  isWithin: (budgetId: string, ancestorId: string) => boolean,
  budgetDepth: (budgetId: string) => number,
): readonly BudgetAllocation[] {
  if (baseMinorUnits <= 0n) {
    throw new Error('budget base must be positive');
  }
  const fixedRootTotal = constraints
    .filter(
      (constraint) =>
        findParentConstraint(constraint, constraints, isWithin, budgetDepth) ===
        undefined,
    )
    .reduce((total, constraint) => total + constraint.fixedMinorUnits, 0n);
  const percentageBase = baseMinorUnits - fixedRootTotal;
  if (percentageBase < 0n) {
    throw new Error('root budget allocations exceed the period base');
  }
  const direct = new Map<string, bigint>();
  for (const constraint of constraints) {
    direct.set(
      constraint.id,
      constraint.fixedMinorUnits +
        (percentageBase * BigInt(constraint.percentageBasisPoints)) / 10000n,
    );
  }
  return constraints.map((constraint) => {
    const children = constraints.filter(
      (candidate) =>
        candidate.id !== constraint.id &&
        isWithin(candidate.budgetId, constraint.budgetId),
    );
    const parent = findParentConstraint(
      constraint,
      constraints,
      isWithin,
      budgetDepth,
    );
    const isRoot = parent === undefined;
    const childDirectTotal = children.reduce(
      (total, child) => total + (direct.get(child.id) ?? 0n),
      0n,
    );
    const directAllocation = direct.get(constraint.id) ?? 0n;
    const allocatedMinorUnits =
      isRoot &&
      children.length > 0 &&
      (constraint.mode === 'BY_CHILDREN' || directAllocation === 0n)
        ? childDirectTotal
        : directAllocation;
    return {
      constraintId: constraint.id,
      allocatedMinorUnits,
      contributesToTotals: isRoot,
    };
  });
}

function findParentConstraint(
  constraint: BudgetAllocationConstraint,
  constraints: readonly BudgetAllocationConstraint[],
  isWithin: (budgetId: string, ancestorId: string) => boolean,
  budgetDepth: (budgetId: string) => number,
): BudgetAllocationConstraint | undefined {
  return constraints
    .filter(
      (candidate) =>
        candidate.id !== constraint.id &&
        isWithin(constraint.budgetId, candidate.budgetId),
    )
    .sort(
      (left, right) => budgetDepth(right.budgetId) - budgetDepth(left.budgetId),
    )[0];
}
