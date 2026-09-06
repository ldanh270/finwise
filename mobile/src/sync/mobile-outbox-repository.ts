import type { FinwiseApiClient } from "@finwise/api-client";
import { createCachePartition } from "../session/cache-partition";
import { ApiManualDraftSync, type ManualTransactionApi } from "./online-sync";
import {
  ManualDraftOutbox,
  InMemoryOutboxStore,
  type ManualDraftCommand,
  type OutboxRecord,
} from "./outbox";
import {
  PersistentOutboxSnapshot,
  type JsonStorage,
} from "./outbox-persistence";
import { sqliteJsonStorage } from "./sqlite-storage";

export class MobileOutboxRepository {
  private readonly store = new InMemoryOutboxStore();
  private readonly outbox = new ManualDraftOutbox(this.store);
  private readonly snapshot: PersistentOutboxSnapshot;
  private loaded = false;

  constructor(
    private readonly userId: string,
    private readonly workspaceId: string,
    api: FinwiseApiClient,
    storage: JsonStorage = sqliteJsonStorage,
  ) {
    const partition = createCachePartition(userId, workspaceId);
    this.snapshot = new PersistentOutboxSnapshot(
      storage,
      `${partition.key}:outbox`,
    );
    const transport: ManualTransactionApi = {
      postManualTransaction: (scope, input, idempotencyKey) =>
        api
          .createTransaction(
            scope,
            {
              type: input.type,
              accountId: input.accountId,
              amountMinorUnits: input.amount.minorUnits,
              effectiveDate: input.effectiveDate,
              ...(input.budgetId ? { budgetId: input.budgetId } : {}),
              ...(input.description ? { description: input.description } : {}),
            },
            idempotencyKey,
          )
          .then((transaction) => ({ id: transaction.id })),
    };
    this.syncTransport = new ApiManualDraftSync(transport);
  }

  private readonly syncTransport: ApiManualDraftSync;

  async list(): Promise<readonly OutboxRecord[]> {
    await this.ensureLoaded();
    return this.store.list(this.userId, this.workspaceId);
  }

  async createAndQueue(command: ManualDraftCommand): Promise<OutboxRecord> {
    await this.ensureLoaded();
    const created = this.outbox.create(command);
    const queued =
      created.state === "LOCAL_DRAFT"
        ? this.outbox.queue(created.clientCommandId)
        : created;
    await this.persist();
    return queued;
  }

  async syncPending(): Promise<readonly OutboxRecord[]> {
    await this.ensureLoaded();
    const pending = this.store
      .list(this.userId, this.workspaceId)
      .filter(
        (record) =>
          record.state === "QUEUED" || record.state === "RETRYABLE_FAILURE",
      );
    const results: OutboxRecord[] = [];
    for (const record of pending) {
      if (record.state === "RETRYABLE_FAILURE")
        this.outbox.queue(record.clientCommandId);
      results.push(
        await this.outbox.sync(record.clientCommandId, this.syncTransport),
      );
    }
    await this.persist();
    return results;
  }

  async canLogout(): Promise<boolean> {
    await this.ensureLoaded();
    return this.outbox.canLogout(this.userId, this.workspaceId);
  }
  async pendingCount(): Promise<number> {
    await this.ensureLoaded();
    return this.outbox.pendingCount(this.userId, this.workspaceId);
  }

  async discard(clientCommandId: string): Promise<void> {
    await this.ensureLoaded();
    this.outbox.discard(clientCommandId);
    await this.persist();
  }

  async markExported(
    clientCommandIds: readonly string[],
  ): Promise<readonly OutboxRecord[]> {
    await this.ensureLoaded();
    const exported: OutboxRecord[] = [];
    for (const clientCommandId of clientCommandIds) {
      const current = this.store.find(clientCommandId);
      if (
        !current ||
        current.state === "SYNCED" ||
        current.state === "DISCARDED" ||
        current.state === "EXPORTED"
      ) {
        continue;
      }
      exported.push(this.outbox.export(clientCommandId));
    }
    if (exported.length > 0) await this.persist();
    return exported;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.snapshot.load(this.store);
    this.loaded = true;
    const interrupted = this.store
      .list(this.userId, this.workspaceId)
      .filter((record) => record.state === "SYNCING");
    for (const record of interrupted)
      this.outbox.recoverInterruptedSync(record.clientCommandId);
    if (interrupted.length > 0) await this.persist();
  }
  private persist(): Promise<void> {
    return this.snapshot.save(this.store, this.userId, this.workspaceId);
  }
}
