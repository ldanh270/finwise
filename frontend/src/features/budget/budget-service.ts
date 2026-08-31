import { createHttpFinwiseApi } from "../../lib/api/client";
import type {
  ApiResult,
  BudgetOverviewSummary,
  BudgetPeriodSummary,
  CategorySummary,
  TagSummary,
} from "../../lib/api/contracts";

const api = createHttpFinwiseApi();

export type PlanningSnapshot = {
  categories: CategorySummary[];
  tags: TagSummary[];
  periods: BudgetPeriodSummary[];
  overview: BudgetOverviewSummary | null;
  selectedMonth: string | null;
};

export async function loadPlanning(
  workspaceId: string,
  selectedMonth?: string,
): Promise<ApiResult<PlanningSnapshot>> {
  const [categories, tags, periods] = await Promise.all([
    api.getCategories(workspaceId),
    api.getTags(workspaceId),
    api.getBudgetPeriods(workspaceId),
  ]);
  if (!categories.ok) return categories;
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
        categories: categories.value,
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
      categories: categories.value,
      tags: tags.value,
      periods: periods.value,
      overview: overview.value,
      selectedMonth: month,
    },
  };
}

export function createCategory(
  workspaceId: string,
  input: { name: string; parentId?: string },
) {
  return api.createCategory(workspaceId, input);
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
