import type { JsonStorage } from "../sync/outbox-persistence";

jest.mock("../sync/sqlite-storage", () => ({
  sqliteJsonStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

import { WorkspaceCache } from "./workspace-cache";

class MemoryJsonStorage implements JsonStorage {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe("WorkspaceCache", () => {
  it("persists budget reads and merges concurrent writes", async () => {
    const storage = new MemoryJsonStorage();
    const cache = new WorkspaceCache("user-1", "workspace-1", storage);
    const overview = {
      month: "2026-09",
      value: {
        id: "budget-1",
        workspaceId: "workspace-1",
        month: "2026-09",
        base: { currency: "VND" as const, minorUnits: "5000000" },
        carry: { currency: "VND" as const, minorUnits: "0" },
        status: "open",
        constraints: [],
        totals: {
          allocated: { currency: "VND" as const, minorUnits: "1000000" },
          actual: { currency: "VND" as const, minorUnits: "125000" },
          remaining: { currency: "VND" as const, minorUnits: "875000" },
        },
      },
    };

    await Promise.all([
      cache.write({
        budgetPeriods: [
          {
            id: "period-1",
            workspaceId: "workspace-1",
            month: "2026-09",
            base: { currency: "VND", minorUnits: "5000000" },
            carry: { currency: "VND", minorUnits: "0" },
            status: "open",
          },
        ],
      }),
      cache.write({ budgetOverviews: [overview] }),
    ]);

    await expect(cache.read()).resolves.toMatchObject({
      budgetPeriods: [{ month: "2026-09" }],
      budgetOverviews: [{ month: "2026-09" }],
    });
  });

  it("partitions reads by user and workspace", async () => {
    const storage = new MemoryJsonStorage();
    await new WorkspaceCache("user-1", "workspace-1", storage).write({
      categories: [
        {
          id: "category-1",
          workspaceId: "workspace-1",
          name: "Food",
          status: "active",
        },
      ],
    });

    await expect(
      new WorkspaceCache("user-1", "workspace-2", storage).read(),
    ).resolves.toBeNull();
    await expect(
      new WorkspaceCache("user-2", "workspace-1", storage).read(),
    ).resolves.toBeNull();
  });
});
