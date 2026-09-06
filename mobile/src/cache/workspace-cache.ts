import type {
  AccountSummary,
  BalanceViewSummary,
  BudgetOverviewSummary,
  BudgetPeriodSummary,
  BudgetSummary,
  OverviewResponse,
  TagSummary,
  TransactionSummary,
} from "@finwise/api-client";
import { createCachePartition } from "../session/cache-partition";
import { sqliteJsonStorage } from "../sync/sqlite-storage";
import type { JsonStorage } from "../sync/outbox-persistence";

export type WorkspaceCachedReads = {
  readonly savedAt: string;
  readonly overview?: OverviewResponse;
  readonly accounts?: readonly AccountSummary[];
  readonly transactions?: readonly TransactionSummary[];
  readonly balances?: readonly BalanceViewSummary[];
  readonly budgetPeriods?: readonly BudgetPeriodSummary[];
  readonly budgets?: readonly BudgetSummary[];
  readonly tags?: readonly TagSummary[];
  readonly budgetOverviews?: readonly BudgetOverviewCache[];
};

export type BudgetOverviewCache = {
  readonly month: string;
  readonly value: BudgetOverviewSummary;
};

export class WorkspaceCache {
  private readonly key: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    userId: string,
    workspaceId: string,
    private readonly storage: JsonStorage = sqliteJsonStorage,
  ) {
    this.key = `${createCachePartition(userId, workspaceId).key}:reads`;
  }

  async read(): Promise<WorkspaceCachedReads | null> {
    const raw = await this.storage.getItem(this.key);
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
    const nextWrite = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        const current = await this.read();
        await this.storage.setItem(
          this.key,
          JSON.stringify({
            ...current,
            ...patch,
            savedAt: new Date().toISOString(),
          }),
        );
      });
    this.writeQueue = nextWrite;
    return nextWrite;
  }

  clear(): Promise<void> {
    return this.storage.removeItem(this.key);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
