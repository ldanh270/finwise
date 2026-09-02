import { createHttpFinwiseApi } from "../../lib/api/client";
import type { ApiResult, ReportsResponse } from "../../lib/api/contracts";

const api = createHttpFinwiseApi();

export function loadReports(
  workspaceId: string,
  options: { fromMonth: string; toMonth: string },
): Promise<ApiResult<ReportsResponse>> {
  return api.getReports(workspaceId, options);
}
