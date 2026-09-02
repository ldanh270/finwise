import type { FinwiseApiClient, ReportsResponse } from "@finwise/api-client";

export function getReports(
  api: FinwiseApiClient,
  workspaceId: string,
  range: { readonly fromMonth: string; readonly toMonth: string },
): Promise<ReportsResponse> {
  return api.getReports(workspaceId, range);
}
