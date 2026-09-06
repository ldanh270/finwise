import type {
  BudgetRecord,
  ClassificationLineRecord,
  JournalTransactionRecord,
} from './ledger.types';

export interface ReportMoney {
  readonly incomeMinorUnits: bigint;
  readonly spendingMinorUnits: bigint;
  readonly netMinorUnits: bigint;
}

export interface ReportMonth extends ReportMoney {
  readonly month: string;
}

export interface ReportBudget extends ReportMoney {
  readonly budgetId: string | null;
  readonly budgetName: string;
}

export interface ReportProjection {
  readonly fromMonth: string;
  readonly toMonth: string;
  readonly totals: ReportMoney;
  readonly monthly: readonly ReportMonth[];
  readonly budgets: readonly ReportBudget[];
}

export interface ReportClassificationReader {
  getClassification(transactionId: string): readonly ClassificationLineRecord[];
}

export function buildReportProjection(
  transactions: readonly JournalTransactionRecord[],
  budgets: readonly BudgetRecord[],
  fromMonth: string,
  toMonth: string,
  classifications: ReportClassificationReader,
): ReportProjection {
  assertMonth(fromMonth, 'fromMonth');
  assertMonth(toMonth, 'toMonth');
  if (fromMonth > toMonth) {
    throw new Error('fromMonth must not be after toMonth.');
  }

  const months = enumerateMonths(fromMonth, toMonth);
  const monthly = new Map<string, ReportMoney>(
    months.map((month) => [month, emptyMoney()]),
  );
  const budgetNames = new Map(
    budgets.map((budget) => [budget.id, budget.name] as const),
  );
  const budgetTotals = new Map<string | null, ReportMoney>();

  for (const transaction of transactions) {
    const month = transaction.effectiveDate.slice(0, 7);
    if (
      transaction.status !== 'posted' ||
      !monthly.has(month) ||
      (transaction.kind !== 'income' && transaction.kind !== 'expense')
    ) {
      continue;
    }

    const amount = transaction.amountMinorUnits;
    const current = monthly.get(month) ?? emptyMoney();
    monthly.set(month, addMoney(current, transaction.kind, amount));

    if (transaction.kind !== 'expense') {
      continue;
    }
    const lines = classifications.getClassification(transaction.id);
    if (lines.length === 0) {
      const currentBudget = budgetTotals.get(null) ?? emptyMoney();
      budgetTotals.set(null, addMoney(currentBudget, transaction.kind, amount));
      continue;
    }
    for (const line of lines) {
      const currentBudget = budgetTotals.get(line.budgetId) ?? emptyMoney();
      budgetTotals.set(
        line.budgetId,
        addMoney(currentBudget, transaction.kind, line.amountMinorUnits),
      );
    }
  }

  const monthlyRows = months.map((month) => ({
    month,
    ...toNet(monthly.get(month) ?? emptyMoney()),
  }));
  const totals = monthlyRows.reduce(
    (result, row) => addMoney(result, 'income', row.incomeMinorUnits),
    emptyMoney(),
  );
  const spendingTotals = monthlyRows.reduce(
    (result, row) => addMoney(result, 'expense', row.spendingMinorUnits),
    emptyMoney(),
  );
  const combinedTotals = {
    incomeMinorUnits: totals.incomeMinorUnits,
    spendingMinorUnits: spendingTotals.spendingMinorUnits,
    netMinorUnits: totals.incomeMinorUnits - spendingTotals.spendingMinorUnits,
  };

  const budgetRows = [...budgetTotals.entries()]
    .map(([budgetId, money]) => ({
      budgetId,
      budgetName:
        budgetId === null
          ? 'Unassigned'
          : (budgetNames.get(budgetId) ?? 'Archived budget'),
      ...toNet(money),
    }))
    .sort((left, right) => {
      if (right.spendingMinorUnits !== left.spendingMinorUnits) {
        return right.spendingMinorUnits > left.spendingMinorUnits ? 1 : -1;
      }
      return left.budgetName.localeCompare(right.budgetName);
    });

  return {
    fromMonth,
    toMonth,
    totals: combinedTotals,
    monthly: monthlyRows,
    budgets: budgetRows,
  };
}

function emptyMoney(): ReportMoney {
  return {
    incomeMinorUnits: 0n,
    spendingMinorUnits: 0n,
    netMinorUnits: 0n,
  };
}

function addMoney(
  money: ReportMoney,
  kind: 'income' | 'expense',
  amountMinorUnits: bigint,
): ReportMoney {
  if (kind === 'income') {
    return {
      ...money,
      incomeMinorUnits: money.incomeMinorUnits + amountMinorUnits,
      netMinorUnits: money.netMinorUnits + amountMinorUnits,
    };
  }
  return {
    ...money,
    spendingMinorUnits: money.spendingMinorUnits + amountMinorUnits,
    netMinorUnits: money.netMinorUnits - amountMinorUnits,
  };
}

function toNet(money: ReportMoney): ReportMoney {
  return {
    incomeMinorUnits: money.incomeMinorUnits,
    spendingMinorUnits: money.spendingMinorUnits,
    netMinorUnits: money.incomeMinorUnits - money.spendingMinorUnits,
  };
}

function assertMonth(value: string, field: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error(`${field} must use YYYY-MM format.`);
  }
}

function enumerateMonths(
  fromMonth: string,
  toMonth: string,
): readonly string[] {
  const result: string[] = [];
  let [year, month] = fromMonth.split('-').map(Number);
  const [endYear, endMonth] = toMonth.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(
      `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`,
    );
    month += 1;
    if (month === 13) {
      year += 1;
      month = 1;
    }
  }
  return result;
}
