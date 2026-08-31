export type ImportSessionStatus = 'received' | 'needs_review' | 'resolved';
export type ImportedRecordStatus =
  | 'received'
  | 'needs_review'
  | 'matched'
  | 'confirmed'
  | 'ignored'
  | 'needs_attention';
export type ReconciliationStatus = 'open' | 'resolved';
export type ImportedTransactionType = 'income' | 'expense';

export interface ImportSessionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly fileName: string;
  readonly fileHash: string;
  readonly rawSizeBytes: number;
  rawDeletedAt?: Date;
  status: ImportSessionStatus;
  readonly createdByMemberId: string;
  readonly createdAt: Date;
}

export interface ImportedRecordRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly effectiveDate: string;
  readonly amountMinorUnits: bigint;
  readonly type: ImportedTransactionType;
  readonly description: string;
  readonly sourceKey: string;
  readonly fingerprint: string;
  status: ImportedRecordStatus;
  matchedTransactionId?: string;
  confirmedTransactionId?: string;
  decisionReason?: string;
  readonly createdAt: Date;
}

export interface ReconciliationCheckpointRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly statementDate: string;
  readonly externalBalanceMinorUnits: bigint;
  readonly ledgerBalanceMinorUnits: bigint;
  readonly differenceMinorUnits: bigint;
  status: ReconciliationStatus;
  adjustmentTransactionId?: string;
  readonly createdByMemberId: string;
  readonly createdAt: Date;
}
