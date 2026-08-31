import { AuthenticatedActor } from '../../shared/application/auth';
import {
  ImportedRecordRecord,
  ImportSessionRecord,
  ImportedTransactionType,
  ReconciliationCheckpointRecord,
} from '../domain/ingestion.types';

export interface ImportStorePort {
  createSession(
    workspaceId: string,
    actor: AuthenticatedActor,
    accountId: string,
    fileName: string,
    csvContent: string,
  ): { readonly session: ImportSessionRecord; readonly duplicate: boolean };
  listSessions(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly ImportSessionRecord[];
  listRecords(
    workspaceId: string,
    actor: AuthenticatedActor,
    sessionId: string,
  ): readonly ImportedRecordRecord[];
  deleteRaw(
    workspaceId: string,
    actor: AuthenticatedActor,
    sessionId: string,
  ): ImportSessionRecord;
  matchRecord(
    workspaceId: string,
    actor: AuthenticatedActor,
    recordId: string,
    transactionId: string,
  ): ImportedRecordRecord;
  confirmRecord(
    workspaceId: string,
    actor: AuthenticatedActor,
    recordId: string,
    idempotencyKey: string,
  ): ImportedRecordRecord;
  decideRecord(
    workspaceId: string,
    actor: AuthenticatedActor,
    recordId: string,
    status: 'ignored' | 'needs_attention',
    reason: string,
  ): ImportedRecordRecord;
  startReconciliation(
    workspaceId: string,
    actor: AuthenticatedActor,
    accountId: string,
    statementDate: string,
    externalBalanceMinorUnits: bigint,
  ): ReconciliationCheckpointRecord;
  listReconciliations(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly ReconciliationCheckpointRecord[];
  adjustReconciliation(
    workspaceId: string,
    actor: AuthenticatedActor,
    checkpointId: string,
    amountMinorUnits: bigint,
    reason: string,
    effectiveDate: string,
  ): ReconciliationCheckpointRecord;
}

export interface ParsedImportRow {
  readonly effectiveDate: string;
  readonly amountMinorUnits: bigint;
  readonly type: ImportedTransactionType;
  readonly description: string;
  readonly sourceKey: string;
}
