import type {
  CategoryRecord,
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

export interface ReportCategory extends ReportMoney {
  readonly categoryId: string | null;
  readonly categoryName: string;
}

export interface ReportProjection {
  readonly fromMonth: string;
  readonly toMonth: string;
  readonly totals: ReportMoney;
  readonly monthly: readonly ReportMonth[];
  readonly categories: readonly ReportCategory[];
}

export interface ReportClassificationReader {
  getClassification(transactionId: string): readonly ClassificationLineRecord[];
}

export function buildReportProjection(
  transactions: readonly JournalTransactionRecord[],
  categories: readonly CategoryRecord[],
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
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name] as const),
  );
  const categoryTotals = new Map<string | null, ReportMoney>();

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
      const currentCategory = categoryTotals.get(null) ?? emptyMoney();
      categoryTotals.set(
        null,
        addMoney(currentCategory, transaction.kind, amount),
      );
      continue;
    }
    for (const line of lines) {
      const currentCategory =
        categoryTotals.get(line.categoryId) ?? emptyMoney();
      categoryTotals.set(
        line.categoryId,
        addMoney(currentCategory, transaction.kind, line.amountMinorUnits),
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

  const categoryRows = [...categoryTotals.entries()]
    .map(([categoryId, money]) => ({
      categoryId,
      categoryName:
        categoryId === null
          ? 'Uncategorized'
          : (categoryNames.get(categoryId) ?? 'Archived category'),
      ...toNet(money),
    }))
    .sort((left, right) => {
      if (right.spendingMinorUnits !== left.spendingMinorUnits) {
        return right.spendingMinorUnits > left.spendingMinorUnits ? 1 : -1;
      }
      return left.categoryName.localeCompare(right.categoryName);
    });

  return {
    fromMonth,
    toMonth,
    totals: combinedTotals,
    monthly: monthlyRows,
    categories: categoryRows,
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
