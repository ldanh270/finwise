import { buildReportProjection } from './report';
import type {
  BudgetRecord,
  ClassificationLineRecord,
  JournalTransactionRecord,
} from './ledger.types';

const budget: BudgetRecord = {
  id: 'budget-food',
  workspaceId: 'workspace-1',
  name: 'Food',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function transaction(
  id: string,
  kind: JournalTransactionRecord['kind'],
  amountMinorUnits: bigint,
  effectiveDate: string,
  status: JournalTransactionRecord['status'] = 'posted',
): JournalTransactionRecord {
  return {
    id,
    workspaceId: 'workspace-1',
    kind,
    status,
    amountMinorUnits,
    currency: 'VND',
    effectiveDate,
    recordedAt: new Date(`${effectiveDate}T00:00:00.000Z`),
    createdByMemberId: 'member-1',
    entries: [],
  };
}

function line(
  transactionId: string,
  amountMinorUnits: bigint,
): ClassificationLineRecord {
  return {
    id: `line-${transactionId}`,
    workspaceId: 'workspace-1',
    transactionId,
    budgetId: budget.id,
    amountMinorUnits,
    tagIds: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('buildReportProjection', () => {
  it('aggregates posted income, spending and budget allocations by month', () => {
    const classifications = new Map<
      string,
      readonly ClassificationLineRecord[]
    >([['expense-1', [line('expense-1', 300n)]]]);
    const projection = buildReportProjection(
      [
        transaction('income-1', 'income', 1000n, '2026-01-10'),
        transaction('expense-1', 'expense', 300n, '2026-01-12'),
        transaction('transfer-1', 'transfer', 500n, '2026-01-15'),
        transaction('voided-1', 'expense', 900n, '2026-01-20', 'voided'),
      ],
      [budget],
      '2026-01',
      '2026-02',
      { getClassification: (id) => classifications.get(id) ?? [] },
    );

    expect(projection.totals).toEqual({
      incomeMinorUnits: 1000n,
      spendingMinorUnits: 300n,
      netMinorUnits: 700n,
    });
    expect(projection.monthly).toEqual([
      {
        month: '2026-01',
        incomeMinorUnits: 1000n,
        spendingMinorUnits: 300n,
        netMinorUnits: 700n,
      },
      {
        month: '2026-02',
        incomeMinorUnits: 0n,
        spendingMinorUnits: 0n,
        netMinorUnits: 0n,
      },
    ]);
    expect(projection.budgets).toEqual([
      {
        budgetId: budget.id,
        budgetName: 'Food',
        incomeMinorUnits: 0n,
        spendingMinorUnits: 300n,
        netMinorUnits: -300n,
      },
    ]);
  });

  it('keeps unclassified activity visible and validates the requested range', () => {
    const projection = buildReportProjection(
      [transaction('expense-1', 'expense', 250n, '2026-02-01')],
      [],
      '2026-02',
      '2026-02',
      { getClassification: () => [] },
    );
    expect(projection.budgets[0]).toMatchObject({
      budgetId: null,
      budgetName: 'Unassigned',
      spendingMinorUnits: 250n,
    });
    expect(() =>
      buildReportProjection([], [], '2026-03', '2026-02', {
        getClassification: () => [],
      }),
    ).toThrow('fromMonth must not be after toMonth.');
  });
});
