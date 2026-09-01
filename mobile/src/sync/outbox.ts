export type DraftKind = "income" | "expense";

export type OutboxState =
  | "LOCAL_DRAFT"
  | "QUEUED"
  | "SYNCING"
  | "SYNCED"
  | "DISCARDED"
  | "EXPORTED"
  | "RETRYABLE_FAILURE"
  | "NEEDS_USER_ACTION";

export type MoneyDto = {
  readonly currency: "VND";
  readonly minorUnits: string;
};

export interface ManualDraftCommand {
  readonly clientCommandId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly kind: DraftKind;
  readonly amount: MoneyDto;
  readonly effectiveDate: string;
  readonly description?: string;
}

export interface OutboxRecord extends ManualDraftCommand {
  readonly state: OutboxState;
  readonly attempts: number;
  readonly lastErrorCode?: string;
  readonly serverTransactionId?: string;
}

export interface OutboxStore {
  find(clientCommandId: string): OutboxRecord | undefined;
  save(record: OutboxRecord): void;
  list(userId: string, workspaceId: string): readonly OutboxRecord[];
}

export interface ManualDraftSyncPort {
  postManualTransaction(
    command: ManualDraftCommand,
    idempotencyKey: string,
  ): Promise<{ readonly transactionId: string }>;
}

type SyncFailure = {
  readonly code?: unknown;
  readonly envelope?: { readonly code?: unknown };
};

export class InMemoryOutboxStore implements OutboxStore {
  private readonly records = new Map<string, OutboxRecord>();

  find(clientCommandId: string): OutboxRecord | undefined {
    return this.records.get(clientCommandId);
  }

  save(record: OutboxRecord): void {
    this.records.set(record.clientCommandId, record);
  }

  list(userId: string, workspaceId: string): readonly OutboxRecord[] {
    return [...this.records.values()].filter(
      (record) =>
        record.userId === userId && record.workspaceId === workspaceId,
    );
  }
}

export class ManualDraftOutbox {
  constructor(private readonly store: OutboxStore) {}

  create(command: ManualDraftCommand): OutboxRecord {
    validateDraft(command);
    const existing = this.store.find(command.clientCommandId);
    if (existing) {
      if (!sameCommand(existing, command)) {
        throw new Error("clientCommandId was already used for another draft");
      }
      return existing;
    }
    const record: OutboxRecord = {
      ...command,
      state: "LOCAL_DRAFT",
      attempts: 0,
    };
    this.store.save(record);
    return record;
  }

  queue(clientCommandId: string): OutboxRecord {
    return this.transition(
      clientCommandId,
      ["LOCAL_DRAFT", "RETRYABLE_FAILURE"],
      {
        state: "QUEUED",
        lastErrorCode: undefined,
      },
    );
  }

  beginSync(clientCommandId: string): OutboxRecord {
    return this.transition(clientCommandId, ["QUEUED"], {
      state: "SYNCING",
    });
  }

  recoverInterruptedSync(clientCommandId: string): OutboxRecord {
    return this.transition(clientCommandId, ["SYNCING"], {
      state: "QUEUED",
      lastErrorCode: undefined,
    });
  }

  markSynced(
    clientCommandId: string,
    serverTransactionId: string,
  ): OutboxRecord {
    if (!serverTransactionId.trim())
      throw new Error("serverTransactionId is required");
    return this.transition(clientCommandId, ["SYNCING"], {
      state: "SYNCED",
      serverTransactionId,
      lastErrorCode: undefined,
    });
  }

  markRetryableFailure(
    clientCommandId: string,
    errorCode: string,
  ): OutboxRecord {
    if (!errorCode.trim()) throw new Error("errorCode is required");
    const record = this.require(clientCommandId);
    if (record.state !== "SYNCING")
      throw new Error("Only syncing drafts can fail");
    const next: OutboxRecord = {
      ...record,
      state: "RETRYABLE_FAILURE",
      attempts: record.attempts + 1,
      lastErrorCode: errorCode,
    };
    this.store.save(next);
    return next;
  }

  markNeedsUserAction(
    clientCommandId: string,
    errorCode: string,
  ): OutboxRecord {
    if (!errorCode.trim()) throw new Error("errorCode is required");
    const record = this.require(clientCommandId);
    if (record.state !== "SYNCING")
      throw new Error("Only syncing drafts need action");
    const next: OutboxRecord = {
      ...record,
      state: "NEEDS_USER_ACTION",
      attempts: record.attempts + 1,
      lastErrorCode: errorCode,
    };
    this.store.save(next);
    return next;
  }

  discard(clientCommandId: string): OutboxRecord {
    const record = this.require(clientCommandId);
    if (record.state === "SYNCING")
      throw new Error("Cannot discard a syncing draft");
    const next: OutboxRecord = { ...record, state: "DISCARDED" };
    this.store.save(next);
    return next;
  }

  export(clientCommandId: string): OutboxRecord {
    return this.transition(
      clientCommandId,
      ["LOCAL_DRAFT", "QUEUED", "RETRYABLE_FAILURE", "NEEDS_USER_ACTION"],
      { state: "EXPORTED", lastErrorCode: undefined },
    );
  }

  canLogout(userId: string, workspaceId: string): boolean {
    return this.store
      .list(userId, workspaceId)
      .every(
        (record) =>
          record.state === "SYNCED" ||
          record.state === "DISCARDED" ||
          record.state === "EXPORTED",
      );
  }

  pendingCount(userId: string, workspaceId: string): number {
    return this.store
      .list(userId, workspaceId)
      .filter(
        (record) =>
          record.state !== "SYNCED" &&
          record.state !== "DISCARDED" &&
          record.state !== "EXPORTED",
      ).length;
  }

  async sync(
    clientCommandId: string,
    transport: ManualDraftSyncPort,
  ): Promise<OutboxRecord> {
    const queued = this.require(clientCommandId);
    if (queued.state !== "QUEUED") {
      throw new Error("Only queued drafts can sync");
    }
    const syncing = this.beginSync(clientCommandId);
    try {
      const result = await transport.postManualTransaction(
        syncing,
        idempotencyKeyFor(syncing.clientCommandId),
      );
      return this.markSynced(clientCommandId, result.transactionId);
    } catch (error: unknown) {
      const code = failureCode(error);
      if (isUserActionFailure(code)) {
        return this.markNeedsUserAction(clientCommandId, code);
      }
      return this.markRetryableFailure(clientCommandId, code);
    }
  }

  private transition(
    clientCommandId: string,
    allowedStates: readonly OutboxState[],
    patch: Partial<OutboxRecord>,
  ): OutboxRecord {
    const record = this.require(clientCommandId);
    if (!allowedStates.includes(record.state)) {
      throw new Error(`Cannot transition ${record.state} draft`);
    }
    const next: OutboxRecord = { ...record, ...patch };
    this.store.save(next);
    return next;
  }

  private require(clientCommandId: string): OutboxRecord {
    const record = this.store.find(clientCommandId);
    if (!record) throw new Error("Draft was not found");
    return record;
  }
}

export function idempotencyKeyFor(clientCommandId: string): string {
  const normalized = clientCommandId.trim();
  if (!normalized) throw new Error("clientCommandId is required");
  return normalized;
}

function validateDraft(command: ManualDraftCommand): void {
  if (!command.clientCommandId.trim())
    throw new Error("clientCommandId is required");
  if (!command.userId.trim() || !command.workspaceId.trim()) {
    throw new Error("userId and workspaceId are required");
  }
  if (!command.accountId.trim()) throw new Error("accountId is required");
  if (command.kind !== "income" && command.kind !== "expense") {
    throw new Error("Offline drafts support income and expense only");
  }
  if (
    command.amount.currency !== "VND" ||
    !/^\d+$/.test(command.amount.minorUnits)
  ) {
    throw new Error("amount must be a VND minor-unit string");
  }
  if (BigInt(command.amount.minorUnits) <= 0n) {
    throw new Error("amount must be positive");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(command.effectiveDate)) {
    throw new Error("effectiveDate must use YYYY-MM-DD");
  }
}

function sameCommand(left: OutboxRecord, right: ManualDraftCommand): boolean {
  return (
    left.userId === right.userId &&
    left.workspaceId === right.workspaceId &&
    left.accountId === right.accountId &&
    left.kind === right.kind &&
    left.amount.currency === right.amount.currency &&
    left.amount.minorUnits === right.amount.minorUnits &&
    left.effectiveDate === right.effectiveDate &&
    left.description === right.description
  );
}

function failureCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const failure = error as SyncFailure;
    if (typeof failure.code === "string" && failure.code.trim())
      return failure.code.trim();
    if (
      typeof failure.envelope?.code === "string" &&
      failure.envelope.code.trim()
    ) {
      return failure.envelope.code.trim();
    }
  }
  return "NETWORK_ERROR";
}

function isUserActionFailure(code: string): boolean {
  return (
    code === "CONFLICT" ||
    code === "VALIDATION_FAILED" ||
    code === "IDEMPOTENCY_KEY_REUSED" ||
    code === "PERMISSION_DENIED" ||
    code === "MEMBERSHIP_REQUIRED"
  );
}
