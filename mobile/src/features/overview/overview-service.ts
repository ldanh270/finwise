import type {
  BalanceViewSummary,
  FinwiseApiClient,
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
