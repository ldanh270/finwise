import { AuthenticatedActor } from '../../shared/application/auth';
import { MVP_CURRENCY } from '../../shared/domain/money';
import { FinwiseError } from '../../shared/errors/finwise-error';
import {
  ImportedRecordRecord,
  ImportSessionRecord,
  ReconciliationCheckpointRecord,
} from '../domain/ingestion.types';
import { ImportStorePort } from './ingestion.ports';

export interface ImportSessionResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly fileName: string;
  readonly fileHash: string;
  readonly rawSizeBytes: number;
  readonly rawDeletedAt?: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface ImportedRecordResponse {
  readonly id: string;
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly effectiveDate: string;
  readonly amount: {
    readonly currency: typeof MVP_CURRENCY;
    readonly minorUnits: string;
  };
  readonly type: string;
  readonly description: string;
  readonly sourceKey: string;
  readonly status: string;
  readonly matchedTransactionId?: string;
  readonly confirmedTransactionId?: string;
  readonly decisionReason?: string;
}

export interface ReconciliationResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly statementDate: string;
  readonly externalBalance: {
    readonly currency: typeof MVP_CURRENCY;
    readonly minorUnits: string;
  };
  readonly ledgerBalance: {
    readonly currency: typeof MVP_CURRENCY;
    readonly minorUnits: string;
  };
  readonly difference: {
    readonly currency: typeof MVP_CURRENCY;
    readonly minorUnits: string;
  };
  readonly status: string;
  readonly adjustmentTransactionId?: string;
}

export interface BulkConfirmResult {
  readonly results: readonly {
    readonly recordId: string;
    readonly ok: boolean;
    readonly record?: ImportedRecordResponse;
    readonly error?: { readonly code: string; readonly message: string };
  }[];
}

export class IngestionService {
  constructor(private readonly store: ImportStorePort) {}

  createSession(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): ImportSessionResponse & { readonly duplicate: boolean } {
    const input = bodyRecord(body);
    const result = this.store.createSession(
      workspaceId,
      actor,
      requiredString(input, 'accountId', 1, 100),
      requiredString(input, 'fileName', 1, 255),
      requiredString(input, 'csvContent', 1, 10_000_000),
    );
    return {
      ...this.sessionResponse(result.session),
      duplicate: result.duplicate,
    };
  }

  listSessions(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly ImportSessionResponse[] {
    return this.store
      .listSessions(workspaceId, actor)
      .map((session) => this.sessionResponse(session));
  }

  listRecords(
    actor: AuthenticatedActor,
    workspaceId: string,
    sessionId: string,
  ): readonly ImportedRecordResponse[] {
    return this.store
      .listRecords(workspaceId, actor, sessionId)
      .map((record) => this.recordResponse(record));
  }

  deleteRaw(
    actor: AuthenticatedActor,
    workspaceId: string,
    sessionId: string,
  ): ImportSessionResponse {
    return this.sessionResponse(
      this.store.deleteRaw(workspaceId, actor, sessionId),
    );
  }

  matchRecord(
    actor: AuthenticatedActor,
    workspaceId: string,
    recordId: string,
    body: unknown,
  ): ImportedRecordResponse {
    const input = bodyRecord(body);
    return this.recordResponse(
      this.store.matchRecord(
        workspaceId,
        actor,
        recordId,
        requiredString(input, 'transactionId', 1, 100),
      ),
    );
  }

  confirmRecord(
    actor: AuthenticatedActor,
    workspaceId: string,
    recordId: string,
    idempotencyKey: string | undefined,
  ): ImportedRecordResponse {
    if (!idempotencyKey?.trim()) throw FinwiseError.idempotencyRequired();
    return this.recordResponse(
      this.store.confirmRecord(
        workspaceId,
        actor,
        recordId,
        idempotencyKey.trim(),
      ),
    );
  }

  confirmRecords(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): BulkConfirmResult {
    if (!idempotencyKey?.trim()) throw FinwiseError.idempotencyRequired();
    const input = bodyRecord(body);
    const recordIds = requiredRecordIds(input.recordIds);
    return {
      results: recordIds.map((recordId) => {
        try {
          const record = this.store.confirmRecord(
            workspaceId,
            actor,
            recordId,
            `${idempotencyKey.trim()}:${recordId}`,
          );
          return { recordId, ok: true, record: this.recordResponse(record) };
        } catch (error: unknown) {
          if (error instanceof FinwiseError) {
            return {
              recordId,
              ok: false,
              error: { code: error.code, message: error.message },
            };
          }
          return {
            recordId,
            ok: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'The record could not be confirmed.',
            },
          };
        }
      }),
    };
  }

  decideRecord(
    actor: AuthenticatedActor,
    workspaceId: string,
    recordId: string,
    status: 'ignored' | 'needs_attention',
    body: unknown,
  ): ImportedRecordResponse {
    const input = bodyRecord(body);
    return this.recordResponse(
      this.store.decideRecord(
        workspaceId,
        actor,
        recordId,
        status,
        requiredString(input, 'reason', 1, 500),
      ),
    );
  }

  startReconciliation(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): ReconciliationResponse {
    const input = bodyRecord(body);
    return this.reconciliationResponse(
      this.store.startReconciliation(
        workspaceId,
        actor,
        requiredString(input, 'accountId', 1, 100),
        requiredDate(input.statementDate),
        requiredNonNegativeMinorUnits(
          input.externalBalanceMinorUnits,
          'externalBalanceMinorUnits',
        ),
      ),
    );
  }

  listReconciliations(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly ReconciliationResponse[] {
    return this.store
      .listReconciliations(workspaceId, actor)
      .map((checkpoint) => this.reconciliationResponse(checkpoint));
  }

  adjustReconciliation(
    actor: AuthenticatedActor,
    workspaceId: string,
    checkpointId: string,
    body: unknown,
  ): ReconciliationResponse {
    const input = bodyRecord(body);
    return this.reconciliationResponse(
      this.store.adjustReconciliation(
        workspaceId,
        actor,
        checkpointId,
        requiredPositiveMinorUnits(input.amountMinorUnits, 'amountMinorUnits'),
        requiredString(input, 'reason', 1, 500),
        requiredDate(input.effectiveDate),
      ),
    );
  }

  private sessionResponse(session: ImportSessionRecord): ImportSessionResponse {
    return {
      id: session.id,
      workspaceId: session.workspaceId,
      accountId: session.accountId,
      fileName: session.fileName,
      fileHash: session.fileHash,
      rawSizeBytes: session.rawSizeBytes,
      rawDeletedAt: session.rawDeletedAt?.toISOString(),
      status: session.status,
      createdAt: session.createdAt.toISOString(),
    };
  }

  private recordResponse(record: ImportedRecordRecord): ImportedRecordResponse {
    return {
      id: record.id,
      sessionId: record.sessionId,
      workspaceId: record.workspaceId,
      accountId: record.accountId,
      effectiveDate: record.effectiveDate,
      amount: {
        currency: MVP_CURRENCY,
        minorUnits: record.amountMinorUnits.toString(),
      },
      type: record.type,
      description: record.description,
      sourceKey: record.sourceKey,
      status: record.status,
      matchedTransactionId: record.matchedTransactionId,
      confirmedTransactionId: record.confirmedTransactionId,
      decisionReason: record.decisionReason,
    };
  }

  private reconciliationResponse(
    checkpoint: ReconciliationCheckpointRecord,
  ): ReconciliationResponse {
    return {
      id: checkpoint.id,
      workspaceId: checkpoint.workspaceId,
      accountId: checkpoint.accountId,
      statementDate: checkpoint.statementDate,
      externalBalance: moneyResponse(checkpoint.externalBalanceMinorUnits),
      ledgerBalance: moneyResponse(checkpoint.ledgerBalanceMinorUnits),
      difference: moneyResponse(checkpoint.differenceMinorUnits),
      status: checkpoint.status,
      adjustmentTransactionId: checkpoint.adjustmentTransactionId,
    };
  }
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw FinwiseError.validation('Request body must be a JSON object.');
  }
  return Object.fromEntries(Object.entries(body));
}

function requiredString(
  input: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): string {
  const value = input[field];
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw FinwiseError.validation(
      `${field} must be between ${min} and ${max} characters.`,
      { field },
    );
  }
  return value.trim();
}

function requiredPositiveMinorUnits(value: unknown, field: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw FinwiseError.validation(`${field} must be a minor-unit string.`, {
      field,
    });
  }
  const parsed = BigInt(value);
  if (parsed <= 0n) {
    throw FinwiseError.validation(`${field} must be greater than zero.`, {
      field,
    });
  }
  return parsed;
}

function requiredRecordIds(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) {
    throw FinwiseError.validation(
      'recordIds must contain between 1 and 500 ids.',
      {
        field: 'recordIds',
      },
    );
  }
  const recordIds = value.map((recordId) =>
    typeof recordId === 'string' ? recordId.trim() : '',
  );
  if (
    recordIds.some((recordId) => recordId.length < 1 || recordId.length > 100)
  ) {
    throw FinwiseError.validation('recordIds must contain non-empty strings.', {
      field: 'recordIds',
    });
  }
  if (new Set(recordIds).size !== recordIds.length) {
    throw FinwiseError.validation('recordIds must not contain duplicates.', {
      field: 'recordIds',
    });
  }
  return recordIds;
}

function requiredNonNegativeMinorUnits(value: unknown, field: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw FinwiseError.validation(`${field} must be a minor-unit string.`, {
      field,
    });
  }
  return BigInt(value);
}

function requiredDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw FinwiseError.validation('Date must be YYYY-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== value) {
    throw FinwiseError.validation('Date is not a valid calendar date.');
  }
  return value;
}

function moneyResponse(minorUnits: bigint): {
  readonly currency: typeof MVP_CURRENCY;
  readonly minorUnits: string;
} {
  return { currency: MVP_CURRENCY, minorUnits: minorUnits.toString() };
}
