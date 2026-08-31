import { createHash, randomUUID } from 'node:crypto';
import { AuthenticatedActor } from '../../shared/application/auth';
import { FinwiseError } from '../../shared/errors/finwise-error';
import { CoreStorePort } from '../../core/application/core.ports';
import {
  ImportedRecordRecord,
  ImportSessionRecord,
  ImportedTransactionType,
  ReconciliationCheckpointRecord,
} from '../domain/ingestion.types';
import { ImportStorePort } from '../application/ingestion.ports';

export class InMemoryImportStore implements ImportStorePort {
  private readonly sessions = new Map<string, ImportSessionRecord>();
  private readonly records = new Map<string, ImportedRecordRecord>();
  private readonly checkpoints = new Map<
    string,
    ReconciliationCheckpointRecord
  >();
  private readonly confirmIdempotencies = new Map<string, string>();

  constructor(private readonly ledger: CoreStorePort) {}

  createSession(
    workspaceId: string,
    actor: AuthenticatedActor,
    accountId: string,
    fileName: string,
    csvContent: string,
  ): { readonly session: ImportSessionRecord; readonly duplicate: boolean } {
    const memberId = this.ledger.memberIdFor(workspaceId, actor.userId);
    this.ledger.getAccount(workspaceId, accountId, actor);
    if (csvContent.length === 0 || csvContent.length > 10_000_000) {
      throw FinwiseError.validation(
        'CSV content must be between 1 byte and 10 MB.',
      );
    }
    const fileHash = createHash('sha256').update(csvContent).digest('hex');
    const duplicate = [...this.sessions.values()].find(
      (session) =>
        session.workspaceId === workspaceId &&
        session.accountId === accountId &&
        session.fileHash === fileHash,
    );
    if (duplicate) {
      return { session: duplicate, duplicate: true };
    }
    const rows = parseCsv(csvContent);
    const createdAt = new Date();
    const session: ImportSessionRecord = {
      id: randomUUID(),
      workspaceId,
      accountId,
      fileName,
      fileHash,
      rawSizeBytes: Buffer.byteLength(csvContent, 'utf8'),
      status: 'needs_review',
      createdByMemberId: memberId,
      createdAt,
    };
    this.sessions.set(session.id, session);
    for (const [index, row] of rows.entries()) {
      const fingerprint = createHash('sha256')
        .update(
          `${row.effectiveDate}|${row.amountMinorUnits.toString()}|${row.type}|${row.description}|${row.sourceKey}`,
        )
        .digest('hex');
      const seenElsewhere = [...this.records.values()].some(
        (record) =>
          record.workspaceId === workspaceId &&
          record.accountId === accountId &&
          record.fingerprint === fingerprint,
      );
      const record: ImportedRecordRecord = {
        id: randomUUID(),
        sessionId: session.id,
        workspaceId,
        accountId,
        effectiveDate: row.effectiveDate,
        amountMinorUnits: row.amountMinorUnits,
        type: row.type,
        description: row.description,
        sourceKey: row.sourceKey || `row-${index + 1}`,
        fingerprint,
        status: seenElsewhere ? 'needs_attention' : 'needs_review',
        decisionReason: seenElsewhere
          ? 'Possible duplicate of an existing imported record.'
          : undefined,
        createdAt,
      };
      this.records.set(record.id, record);
    }
    return { session, duplicate: false };
  }

  listSessions(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly ImportSessionRecord[] {
    this.ledger.memberIdFor(workspaceId, actor.userId);
    return [...this.sessions.values()]
      .filter((session) => session.workspaceId === workspaceId)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
  }

  listRecords(
    workspaceId: string,
    actor: AuthenticatedActor,
    sessionId: string,
  ): readonly ImportedRecordRecord[] {
    const session = this.requireSession(workspaceId, sessionId, actor);
    this.ledger.getAccount(workspaceId, session.accountId, actor);
    return [...this.records.values()].filter(
      (record) => record.sessionId === session.id,
    );
  }

  deleteRaw(
    workspaceId: string,
    actor: AuthenticatedActor,
    sessionId: string,
  ): ImportSessionRecord {
    const session = this.requireSession(workspaceId, sessionId, actor);
    if (session.rawDeletedAt) return session;
    if (session.status !== 'resolved') {
      throw FinwiseError.businessState(
        'Raw import data can be deleted only after every row is resolved.',
      );
    }
    session.rawDeletedAt = new Date();
    return session;
  }

  matchRecord(
    workspaceId: string,
    actor: AuthenticatedActor,
    recordId: string,
    transactionId: string,
  ): ImportedRecordRecord {
    const record = this.requireRecord(workspaceId, recordId, actor);
    this.ledger.getAccount(workspaceId, record.accountId, actor);
    if (record.status === 'confirmed') return record;
    if (record.status === 'ignored' || record.status === 'needs_attention') {
      throw FinwiseError.businessState(
        'This imported record is not eligible for matching.',
      );
    }
    const transaction = this.ledger.getTransaction(
      workspaceId,
      transactionId,
      actor,
    );
    if (
      transaction.entries.every((entry) => entry.accountId !== record.accountId)
    ) {
      throw FinwiseError.validation(
        'The candidate transaction does not reference the imported account.',
      );
    }
    record.status = 'matched';
    record.matchedTransactionId = transaction.id;
    return record;
  }

  confirmRecord(
    workspaceId: string,
    actor: AuthenticatedActor,
    recordId: string,
    idempotencyKey: string,
  ): ImportedRecordRecord {
    const idempotencyKeyValue = `${workspaceId}:${idempotencyKey}`;
    const previousRecordId = this.confirmIdempotencies.get(idempotencyKeyValue);
    if (previousRecordId && previousRecordId !== recordId) {
      throw FinwiseError.idempotencyReused();
    }
    const record = this.requireRecord(workspaceId, recordId, actor);
    this.ledger.getAccount(workspaceId, record.accountId, actor);
    if (record.status === 'confirmed') {
      if (record.confirmedTransactionId) {
        this.ledger.linkJournalSource(
          workspaceId,
          record.confirmedTransactionId,
          'import_record',
          record.id,
          actor,
        );
      }
      this.refreshSessionStatus(record.sessionId);
      return record;
    }
    if (record.status === 'ignored' || record.status === 'needs_attention') {
      throw FinwiseError.businessState(
        'Only reviewable or matched records can be confirmed.',
      );
    }
    if (record.status === 'matched' && record.matchedTransactionId) {
      record.status = 'confirmed';
      record.confirmedTransactionId = record.matchedTransactionId;
      this.ledger.linkJournalSource(
        workspaceId,
        record.confirmedTransactionId,
        'import_record',
        record.id,
        actor,
      );
      this.confirmIdempotencies.set(idempotencyKeyValue, record.id);
      this.refreshSessionStatus(record.sessionId);
      return record;
    }
    const memberId = this.ledger.memberIdFor(workspaceId, actor.userId);
    const systemAccount = this.ledger.systemAccount(
      workspaceId,
      record.type === 'income' ? 'Imported income' : 'Imported expense',
    );
    const journal = this.ledger.postJournal({
      workspaceId,
      kind: record.type,
      amountMinorUnits: record.amountMinorUnits,
      effectiveDate: record.effectiveDate,
      description: record.description,
      createdByMemberId: memberId,
      entries:
        record.type === 'income'
          ? [
              {
                accountId: record.accountId,
                amountMinorUnits: record.amountMinorUnits,
                direction: 'increase',
              },
              {
                accountId: systemAccount.id,
                amountMinorUnits: record.amountMinorUnits,
                direction: 'decrease',
              },
            ]
          : [
              {
                accountId: record.accountId,
                amountMinorUnits: record.amountMinorUnits,
                direction: 'decrease',
              },
              {
                accountId: systemAccount.id,
                amountMinorUnits: record.amountMinorUnits,
                direction: 'increase',
              },
            ],
    });
    record.status = 'confirmed';
    record.confirmedTransactionId = journal.id;
    this.ledger.linkJournalSource(
      workspaceId,
      journal.id,
      'import_record',
      record.id,
      actor,
    );
    this.confirmIdempotencies.set(idempotencyKeyValue, record.id);
    this.refreshSessionStatus(record.sessionId);
    return record;
  }

  decideRecord(
    workspaceId: string,
    actor: AuthenticatedActor,
    recordId: string,
    status: 'ignored' | 'needs_attention',
    reason: string,
  ): ImportedRecordRecord {
    const record = this.requireRecord(workspaceId, recordId, actor);
    if (record.status === status) return record;
    if (record.status === 'confirmed') {
      throw FinwiseError.businessState('Confirmed records cannot be changed.');
    }
    record.status = status;
    record.decisionReason = reason;
    this.refreshSessionStatus(record.sessionId);
    return record;
  }

  startReconciliation(
    workspaceId: string,
    actor: AuthenticatedActor,
    accountId: string,
    statementDate: string,
    externalBalanceMinorUnits: bigint,
  ): ReconciliationCheckpointRecord {
    const memberId = this.ledger.memberIdFor(workspaceId, actor.userId);
    const account = this.ledger.getAccount(workspaceId, accountId, actor);
    const checkpoint: ReconciliationCheckpointRecord = {
      id: randomUUID(),
      workspaceId,
      accountId: account.id,
      statementDate,
      externalBalanceMinorUnits,
      ledgerBalanceMinorUnits: account.balanceMinorUnits,
      differenceMinorUnits:
        externalBalanceMinorUnits - account.balanceMinorUnits,
      status: 'open',
      createdByMemberId: memberId,
      createdAt: new Date(),
    };
    this.checkpoints.set(checkpoint.id, checkpoint);
    return checkpoint;
  }

  listReconciliations(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly ReconciliationCheckpointRecord[] {
    this.ledger.memberIdFor(workspaceId, actor.userId);
    return [...this.checkpoints.values()]
      .filter((checkpoint) => checkpoint.workspaceId === workspaceId)
      .sort(
        (left, right) =>
          right.statementDate.localeCompare(left.statementDate) ||
          right.createdAt.getTime() - left.createdAt.getTime(),
      );
  }

  adjustReconciliation(
    workspaceId: string,
    actor: AuthenticatedActor,
    checkpointId: string,
    amountMinorUnits: bigint,
    reason: string,
    effectiveDate: string,
  ): ReconciliationCheckpointRecord {
    const memberId = this.ledger.memberIdFor(workspaceId, actor.userId);
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint || checkpoint.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Reconciliation checkpoint');
    }
    if (checkpoint.status === 'resolved') {
      return checkpoint;
    }
    const expectedAmount =
      checkpoint.differenceMinorUnits < 0n
        ? -checkpoint.differenceMinorUnits
        : checkpoint.differenceMinorUnits;
    if (amountMinorUnits <= 0n || amountMinorUnits !== expectedAmount) {
      throw FinwiseError.validation(
        'Adjustment amount must equal the reconciliation difference.',
      );
    }
    const systemAccount = this.ledger.systemAccount(
      workspaceId,
      'Reconciliation adjustment',
    );
    const journal = this.ledger.postJournal({
      workspaceId,
      kind: 'adjustment',
      amountMinorUnits,
      effectiveDate,
      description: `${reason} (${checkpoint.id})`,
      createdByMemberId: memberId,
      entries:
        checkpoint.differenceMinorUnits > 0n
          ? [
              {
                accountId: checkpoint.accountId,
                amountMinorUnits,
                direction: 'increase',
              },
              {
                accountId: systemAccount.id,
                amountMinorUnits,
                direction: 'decrease',
              },
            ]
          : [
              {
                accountId: checkpoint.accountId,
                amountMinorUnits,
                direction: 'decrease',
              },
              {
                accountId: systemAccount.id,
                amountMinorUnits,
                direction: 'increase',
              },
            ],
    });
    checkpoint.status = 'resolved';
    checkpoint.adjustmentTransactionId = journal.id;
    return checkpoint;
  }

  private requireSession(
    workspaceId: string,
    sessionId: string,
    actor: AuthenticatedActor,
  ): ImportSessionRecord {
    this.ledger.memberIdFor(workspaceId, actor.userId);
    const session = this.sessions.get(sessionId);
    if (!session || session.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Import session');
    }
    return session;
  }

  private requireRecord(
    workspaceId: string,
    recordId: string,
    actor: AuthenticatedActor,
  ): ImportedRecordRecord {
    this.ledger.memberIdFor(workspaceId, actor.userId);
    const record = this.records.get(recordId);
    if (!record || record.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Imported record');
    }
    return record;
  }

  private refreshSessionStatus(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'resolved') return;
    const records = [...this.records.values()].filter(
      (record) => record.sessionId === sessionId,
    );
    if (
      records.length > 0 &&
      records.every(
        (record) =>
          record.status === 'confirmed' ||
          record.status === 'ignored' ||
          record.status === 'needs_attention',
      )
    ) {
      session.status = 'resolved';
    }
  }
}

function parseCsv(csvContent: string): readonly {
  readonly effectiveDate: string;
  readonly amountMinorUnits: bigint;
  readonly type: ImportedTransactionType;
  readonly description: string;
  readonly sourceKey: string;
}[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw FinwiseError.validation(
      'CSV must contain a header and at least one row.',
    );
  }
  const headers = splitCsvLine(lines[0] ?? '').map((header) =>
    header.toLowerCase(),
  );
  const requiredHeaders = ['date', 'amountminorunits', 'type'];
  if (requiredHeaders.some((header) => !headers.includes(header))) {
    throw FinwiseError.validation(
      'CSV requires date, amountMinorUnits and type columns.',
    );
  }
  const indexOf = (name: string): number => headers.indexOf(name);
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const date = values[indexOf('date')] ?? '';
    const amount = values[indexOf('amountminorunits')] ?? '';
    const type = values[indexOf('type')] ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw FinwiseError.validation(
        `CSV row ${index + 2} has an invalid date.`,
      );
    }
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (parsedDate.toISOString().slice(0, 10) !== date) {
      throw FinwiseError.validation(
        `CSV row ${index + 2} has an invalid date.`,
      );
    }
    if (!/^(0|[1-9][0-9]*)$/.test(amount) || BigInt(amount) <= 0n) {
      throw FinwiseError.validation(
        `CSV row ${index + 2} has an invalid amountMinorUnits.`,
      );
    }
    if (type !== 'income' && type !== 'expense') {
      throw FinwiseError.validation(
        `CSV row ${index + 2} type must be income or expense.`,
      );
    }
    return {
      effectiveDate: date,
      amountMinorUnits: BigInt(amount),
      type,
      description: values[indexOf('description')] ?? '',
      sourceKey: values[indexOf('sourcekey')] ?? '',
    };
  });
}

function splitCsvLine(line: string): readonly string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}
