import {
  type ApiResult,
  type GroupCollectionProgress,
  type GroupCollectionSummary,
  type GroupDirectExpense,
  type GroupReportSummary,
} from "../../lib/api/contracts";
import { createHttpFinwiseApi } from "../../lib/api/client";

const api = createHttpFinwiseApi();

export type GroupTreasurySnapshot = {
  collections: GroupCollectionSummary[];
  progress: Record<string, GroupCollectionProgress>;
  report: GroupReportSummary;
};

export async function loadGroupTreasury(
  workspaceId: string,
): Promise<ApiResult<GroupTreasurySnapshot>> {
  const [collectionsResult, reportResult] = await Promise.all([
    api.getGroupCollections(workspaceId),
    api.getGroupReportSummary(workspaceId),
  ]);
  if (!collectionsResult.ok) return collectionsResult;
  if (!reportResult.ok) return reportResult;

  const progressResults = await Promise.all(
    collectionsResult.value.map(async (collection) => ({
      collectionId: collection.id,
      result: await api.getGroupCollectionProgress(workspaceId, collection.id),
    })),
  );
  const progress: Record<string, GroupCollectionProgress> = {};
  for (const entry of progressResults) {
    if (!entry.result.ok) return entry.result;
    progress[entry.collectionId] = entry.result.value;
  }
  return {
    ok: true,
    value: {
      collections: collectionsResult.value,
      progress,
      report: reportResult.value,
    },
  };
}

export function postDirectGroupExpense(
  workspaceId: string,
  input: {
    accountId: string;
    amountMinorUnits: string;
    description: string;
    effectiveDate: string;
  },
  idempotencyKey: string,
): Promise<ApiResult<GroupDirectExpense>> {
  return api.createDirectGroupExpense(workspaceId, input, idempotencyKey);
}
