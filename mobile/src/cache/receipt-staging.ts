import { createCachePartition } from "../session/cache-partition";
import type { JsonStorage } from "../sync/outbox-persistence";
import { sqliteJsonStorage } from "../sync/sqlite-storage";

export type StagedReceipt = {
  readonly id: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly fileName: string;
  readonly fileUri: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly createdAt: string;
};

type StageReceiptInput = Omit<
  StagedReceipt,
  "id" | "userId" | "workspaceId" | "createdAt"
>;

/**
 * Keeps local receipt evidence attached to the user/workspace partition until
 * the server supports an upload command. It is deliberately separate from the
 * ledger and never changes balances or transaction state.
 */
export class ReceiptStagingStore {
  private readonly key: string;

  constructor(
    private readonly userId: string,
    private readonly workspaceId: string,
    private readonly storage: JsonStorage = sqliteJsonStorage,
  ) {
    this.key = `${createCachePartition(userId, workspaceId).key}:receipts`;
  }

  async list(): Promise<readonly StagedReceipt[]> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return [];
    return parseReceipts(raw).filter(
      (receipt) =>
        receipt.userId === this.userId &&
        receipt.workspaceId === this.workspaceId,
    );
  }

  async stage(input: StageReceiptInput): Promise<StagedReceipt> {
    const current = await this.list();
    const staged: StagedReceipt = {
      ...input,
      id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      userId: this.userId,
      workspaceId: this.workspaceId,
      createdAt: new Date().toISOString(),
    };
    await this.storage.setItem(this.key, JSON.stringify([...current, staged]));
    return staged;
  }

  async remove(receiptId: string): Promise<void> {
    const remaining = (await this.list()).filter(
      (receipt) => receipt.id !== receiptId,
    );
    await this.storage.setItem(this.key, JSON.stringify(remaining));
  }
}

function parseReceipts(raw: string): StagedReceipt[] {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value.filter(isStagedReceipt);
}

function isStagedReceipt(value: unknown): value is StagedReceipt {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const receipt = value as Record<string, unknown>;
  return (
    typeof receipt.id === "string" &&
    typeof receipt.userId === "string" &&
    typeof receipt.workspaceId === "string" &&
    typeof receipt.fileName === "string" &&
    typeof receipt.fileUri === "string" &&
    (receipt.mimeType === undefined || typeof receipt.mimeType === "string") &&
    (receipt.sizeBytes === undefined ||
      typeof receipt.sizeBytes === "number") &&
    typeof receipt.createdAt === "string"
  );
}
