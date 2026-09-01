import type {
  AccountSummary,
  BalanceViewSummary,
  OverviewResponse,
  TransactionSummary,
} from "@finwise/api-client";
import { createCachePartition } from "../session/cache-partition";
import { sqliteJsonStorage } from "../sync/sqlite-storage";

export type WorkspaceCachedReads = {
  readonly savedAt: string;
  readonly overview?: OverviewResponse;
  readonly accounts?: readonly AccountSummary[];
  readonly transactions?: readonly TransactionSummary[];
  readonly balances?: readonly BalanceViewSummary[];
};

export class WorkspaceCache {
  private readonly key: string;

  constructor(userId: string, workspaceId: string) {
    this.key = `${createCachePartition(userId, workspaceId).key}:reads`;
  }

  async read(): Promise<WorkspaceCachedReads | null> {
    const raw = await sqliteJsonStorage.getItem(this.key);
    if (!raw) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (!isRecord(value) || typeof value.savedAt !== "string") return null;
      return value as WorkspaceCachedReads;
    } catch {
      return null;
    }
  }

  async write(patch: Omit<WorkspaceCachedReads, "savedAt">): Promise<void> {
    const current = await this.read();
    await sqliteJsonStorage.setItem(
      this.key,
      JSON.stringify({
        ...current,
        ...patch,
        savedAt: new Date().toISOString(),
      }),
    );
  }

  clear(): Promise<void> {
    return sqliteJsonStorage.removeItem(this.key);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
