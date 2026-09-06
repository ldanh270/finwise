import { createHttpFinwiseApi } from "../../lib/api/client";
import type {
  ApiResult,
  BudgetOverviewSummary,
  BudgetPeriodSummary,
  BudgetBucketSummary,
  TagSummary,
} from "../../lib/api/contracts";

const api = createHttpFinwiseApi();

export type PlanningSnapshot = {
  budgets: BudgetBucketSummary[];
  tags: TagSummary[];
  periods: BudgetPeriodSummary[];
  overview: BudgetOverviewSummary | null;
  selectedMonth: string | null;
};

export async function loadPlanning(
  workspaceId: string,
  selectedMonth?: string,
): Promise<ApiResult<PlanningSnapshot>> {
  const [budgets, tags, periods] = await Promise.all([
    api.getBudgets(workspaceId),
    api.getTags(workspaceId),
    api.getBudgetPeriods(workspaceId),
  ]);
  if (!budgets.ok) return budgets;
  if (!tags.ok) return tags;
  if (!periods.ok) return periods;
  const month =
    selectedMonth &&
    periods.value.some((period) => period.month === selectedMonth)
      ? selectedMonth
      : (periods.value[0]?.month ?? null);
  if (!month) {
    return {
      ok: true,
      value: {
        budgets: budgets.value,
        tags: tags.value,
        periods: periods.value,
        overview: null,
        selectedMonth: null,
      },
    };
  }
  const overview = await api.getBudgetOverview(workspaceId, month);
  if (!overview.ok) return overview;
  return {
    ok: true,
    value: {
      budgets: budgets.value,
      tags: tags.value,
      periods: periods.value,
      overview: overview.value,
      selectedMonth: month,
    },
  };
}

export function createBudget(
  workspaceId: string,
  input: { name: string; parentId?: string },
) {
  return api.createBudget(workspaceId, input);
}

export function createTag(workspaceId: string, input: { name: string }) {
  return api.createTag(workspaceId, input);
}

export function createBudgetPeriod(
  workspaceId: string,
  input: Parameters<typeof api.createBudgetPeriod>[1],
) {
  return api.createBudgetPeriod(workspaceId, input);
}

export function closeBudgetPeriod(workspaceId: string, month: string) {
  return api.closeBudgetPeriod(workspaceId, month);
}
