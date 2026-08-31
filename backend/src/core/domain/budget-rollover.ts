import { BudgetRolloverMode } from './ledger.types';

export interface BudgetRolloverInput {
  readonly allocatedMinorUnits: bigint;
  readonly actualMinorUnits: bigint;
  readonly mode: BudgetRolloverMode;
}

export interface BudgetRolloverResult {
  readonly closingBalanceMinorUnits: bigint;
  readonly carryMinorUnits: bigint;
}

export function calculateBudgetRollover(
  input: BudgetRolloverInput,
): BudgetRolloverResult {
  if (input.allocatedMinorUnits < 0n || input.actualMinorUnits < 0n) {
    throw new Error('budget amounts must not be negative');
  }
  const closingBalanceMinorUnits =
    input.allocatedMinorUnits - input.actualMinorUnits;
  const carryMinorUnits =
    input.mode === 'NONE'
      ? 0n
      : input.mode === 'POSITIVE_ONLY'
        ? max(closingBalanceMinorUnits, 0n)
        : closingBalanceMinorUnits;
  return { closingBalanceMinorUnits, carryMinorUnits };
}

function max(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}
