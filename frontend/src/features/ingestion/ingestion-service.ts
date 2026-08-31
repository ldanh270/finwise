import { createHttpFinwiseApi } from "../../lib/api/client";
import type {
  ApiResult,
  ImportedRecordSummary,
  ImportSessionSummary,
  ReconciliationSummary,
} from "../../lib/api/contracts";

const api = createHttpFinwiseApi();

export type IngestionSnapshot = {
  sessions: ImportSessionSummary[];
  records: ImportedRecordSummary[];
  reconciliations: ReconciliationSummary[];
  selectedSessionId: string | null;
};

export async function loadIngestion(
  workspaceId: string,
  selectedSessionId?: string,
): Promise<ApiResult<IngestionSnapshot>> {
  const [sessionsResult, reconciliationResult] = await Promise.all([
    api.getImportSessions(workspaceId),
    api.getReconciliations(workspaceId),
  ]);
  if (!sessionsResult.ok) return sessionsResult;
  if (!reconciliationResult.ok) return reconciliationResult;
  const sessionId =
    selectedSessionId &&
    sessionsResult.value.some((session) => session.id === selectedSessionId)
      ? selectedSessionId
      : (sessionsResult.value[0]?.id ?? null);
  if (!sessionId) {
    return {
      ok: true,
      value: {
        sessions: sessionsResult.value,
        records: [],
        reconciliations: reconciliationResult.value,
        selectedSessionId: null,
      },
    };
  }
  const recordsResult = await api.getImportedRecords(workspaceId, sessionId);
  if (!recordsResult.ok) return recordsResult;
  return {
    ok: true,
    value: {
      sessions: sessionsResult.value,
      records: recordsResult.value,
      reconciliations: reconciliationResult.value,
      selectedSessionId: sessionId,
    },
  };
}

export function createImportSession(
  workspaceId: string,
  input: { accountId: string; fileName: string; csvContent: string },
): ReturnType<typeof api.createImportSession> {
  return api.createImportSession(workspaceId, input);
}

export function confirmImportedRecord(
  workspaceId: string,
  recordId: string,
): ReturnType<typeof api.confirmImportedRecord> {
  return api.confirmImportedRecord(
    workspaceId,
    recordId,
    `web-import-confirm-${recordId}-${Date.now()}`,
  );
}

export function decideImportedRecord(
  workspaceId: string,
  recordId: string,
  status: "ignored" | "needs-attention",
): ReturnType<typeof api.decideImportedRecord> {
  return api.decideImportedRecord(
    workspaceId,
    recordId,
    status === "ignored" ? "ignore" : "needs-attention",
    status === "ignored"
      ? "Ignored from web inbox."
      : "Requires manual attention from web inbox.",
  );
}

export function startReconciliation(
  workspaceId: string,
  input: {
    accountId: string;
    statementDate: string;
    externalBalanceMinorUnits: string;
  },
): ReturnType<typeof api.startReconciliation> {
  return api.startReconciliation(workspaceId, input);
}
