import type {
  BudgetOverviewSummary,
  BudgetPeriodSummary,
  CategorySummary,
  FinwiseApiClient,
  TagSummary,
} from "@finwise/api-client";

export type BudgetConstraintInput = {
  readonly categoryId: string;
  readonly mode: "BY_CHILDREN" | "SHARED_POOL" | "HYBRID";
  readonly fixedMinorUnits: string;
  readonly percentageBasisPoints?: number;
  readonly rolloverMode?: "NONE" | "POSITIVE_ONLY" | "FULL_BALANCE";
};

export function getBudgetPeriods(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly BudgetPeriodSummary[]> {
  return api.getBudgetPeriods(workspaceId);
}

export function getCategories(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly CategorySummary[]> {
  return api.getCategories(workspaceId);
}

export function getTags(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly TagSummary[]> {
  return api.getTags(workspaceId);
}

export function getBudgetOverview(
  api: FinwiseApiClient,
  workspaceId: string,
  month: string,
): Promise<BudgetOverviewSummary> {
  return api.getBudgetOverview(workspaceId, month);
}

export function createBudgetPeriod(
  api: FinwiseApiClient,
  workspaceId: string,
  input: {
    readonly month: string;
    readonly baseMinorUnits: string;
    readonly constraints: readonly BudgetConstraintInput[];
  },
): Promise<BudgetPeriodSummary> {
  return api.createBudgetPeriod(workspaceId, input);
}

export function createCategory(
  api: FinwiseApiClient,
  workspaceId: string,
  input: { readonly name: string; readonly parentId?: string },
): Promise<CategorySummary> {
  return api.createCategory(workspaceId, input);
}

export function createTag(
  api: FinwiseApiClient,
  workspaceId: string,
  input: { readonly name: string },
): Promise<TagSummary> {
  return api.createTag(workspaceId, input);
}

export function closeBudgetPeriod(
  api: FinwiseApiClient,
  workspaceId: string,
  month: string,
): Promise<BudgetPeriodSummary> {
  return api.closeBudgetPeriod(workspaceId, month);
}
