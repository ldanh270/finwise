import type { OutboxRecord, OutboxStore } from "./outbox";

export interface JsonStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Serialization boundary for the eventual SQLite/AsyncStorage adapter. The
 * outbox remains in-memory during a command, while callers persist snapshots
 * only in the user/workspace partition and can restore them after process
 * death.
 */
export class PersistentOutboxSnapshot {
  constructor(
    private readonly storage: JsonStorage,
    private readonly key: string,
  ) {}

  async load(store: OutboxStore): Promise<number> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return 0;
    const records = parseRecords(raw);
    for (const record of records) store.save(record);
    return records.length;
  }

  async save(store: OutboxStore, userId: string, workspaceId: string): Promise<void> {
    const records = store.list(userId, workspaceId);
    await this.storage.setItem(this.key, serializeRecords(records));
  }

  async clear(): Promise<void> {
    await this.storage.removeItem(this.key);
  }
}

export function serializeRecords(records: readonly OutboxRecord[]): string {
  return JSON.stringify(records);
}

function parseRecords(raw: string): OutboxRecord[] {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("The persisted outbox snapshot is invalid JSON");
  }
  if (!Array.isArray(value)) {
    throw new Error("The persisted outbox snapshot must be an array");
  }
  return value.map((record, index) => parseRecord(record, index));
}

function parseRecord(value: unknown, index: number): OutboxRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Persisted outbox record ${index} is invalid`);
  }
  const record = value as Record<string, unknown>;
  const amount = record.amount;
  if (
    typeof record.clientCommandId !== "string" ||
    typeof record.userId !== "string" ||
    typeof record.workspaceId !== "string" ||
    typeof record.accountId !== "string" ||
    (record.kind !== "income" && record.kind !== "expense") ||
    typeof amount !== "object" ||
    amount === null ||
    Array.isArray(amount) ||
    (amount as Record<string, unknown>).currency !== "VND" ||
    typeof (amount as Record<string, unknown>).minorUnits !== "string" ||
    typeof record.effectiveDate !== "string" ||
    typeof record.state !== "string" ||
    typeof record.attempts !== "number"
  ) {
    throw new Error(`Persisted outbox record ${index} is invalid`);
  }
  return record as unknown as OutboxRecord;
}
