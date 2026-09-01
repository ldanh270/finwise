import type {
  FinwiseApiClient,
  ImportedRecordSummary,
  ImportSessionSummary,
  ReconciliationSummary,
} from "@finwise/api-client";

export function getImportSessions(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly ImportSessionSummary[]> {
  return api.getImportSessions(workspaceId);
}

export function createImportSession(
  api: FinwiseApiClient,
  workspaceId: string,
  input: {
    readonly accountId: string;
    readonly fileName: string;
    readonly csvContent: string;
  },
): Promise<ImportSessionSummary & { readonly duplicate: boolean }> {
  return api.createImportSession(workspaceId, input);
}

export function getImportedRecords(
  api: FinwiseApiClient,
  workspaceId: string,
  sessionId: string,
): Promise<readonly ImportedRecordSummary[]> {
  return api.getImportedRecords(workspaceId, sessionId);
}

export function deleteImportRaw(
  api: FinwiseApiClient,
  workspaceId: string,
  sessionId: string,
): Promise<ImportSessionSummary> {
  return api.deleteImportRaw(workspaceId, sessionId);
}

export function matchImportedRecord(
  api: FinwiseApiClient,
  workspaceId: string,
  recordId: string,
  transactionId: string,
): Promise<ImportedRecordSummary> {
  return api.matchImportedRecord(workspaceId, recordId, transactionId);
}

export function confirmImportedRecord(
  api: FinwiseApiClient,
  workspaceId: string,
  recordId: string,
  idempotencyKey: string,
): Promise<ImportedRecordSummary> {
  return api.confirmImportedRecord(workspaceId, recordId, idempotencyKey);
}

export function decideImportedRecord(
  api: FinwiseApiClient,
  workspaceId: string,
  recordId: string,
  decision: "ignore" | "needs-attention",
  reason: string,
): Promise<ImportedRecordSummary> {
  return api.decideImportedRecord(workspaceId, recordId, decision, reason);
}

export function getReconciliations(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly ReconciliationSummary[]> {
  return api.getReconciliations(workspaceId);
}

export function startReconciliation(
  api: FinwiseApiClient,
  workspaceId: string,
  input: {
    readonly accountId: string;
    readonly statementDate: string;
    readonly externalBalanceMinorUnits: string;
  },
): Promise<ReconciliationSummary> {
  return api.startReconciliation(workspaceId, input);
}

export function adjustReconciliation(
  api: FinwiseApiClient,
  workspaceId: string,
  checkpointId: string,
  input: {
    readonly amountMinorUnits: string;
    readonly reason: string;
    readonly effectiveDate: string;
  },
): Promise<ReconciliationSummary> {
  return api.adjustReconciliation(workspaceId, checkpointId, input);
}
