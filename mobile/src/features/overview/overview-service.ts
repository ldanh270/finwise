import type {
  BalanceViewSummary,
  FinwiseApiClient,
  MoneyDto,
  OverviewResponse,
} from "@finwise/api-client";

/** Transport operations used by the workspace overview screen. */
export function getOverview(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<OverviewResponse> {
  return api.getOverview(workspaceId);
}

export function getBalanceViews(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly BalanceViewSummary[]> {
  return api.getBalanceViews(workspaceId);
}

export function getOverviewAccountBalances(overview: {
  readonly accountBalances?: readonly MoneyDto[];
}): readonly MoneyDto[] {
  return overview.accountBalances ?? [];
}
