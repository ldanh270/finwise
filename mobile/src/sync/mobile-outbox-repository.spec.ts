import { FinwiseApiClient } from "@finwise/api-client";
import type { JsonStorage } from "./outbox-persistence";
import type { OutboxRecord } from "./outbox";

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
}));

import { MobileOutboxRepository } from "./mobile-outbox-repository";

class MemoryJsonStorage implements JsonStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

describe("MobileOutboxRepository", () => {
  it("marks exported drafts terminal and keeps them out of pending sync", async () => {
    const storage = new MemoryJsonStorage();
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    const repository = new MobileOutboxRepository(
      "user-1",
      "workspace-1",
      api,
      storage,
    );

    await repository.createAndQueue({
      clientCommandId: "client-export",
      userId: "user-1",
      workspaceId: "workspace-1",
      accountId: "account-1",
      kind: "expense",
      amount: { currency: "VND", minorUnits: "9000" },
      effectiveDate: "2026-09-01",
      description: "Keep a copy",
    });

    await expect(repository.markExported(["client-export"])).resolves.toEqual([
      expect.objectContaining({
        clientCommandId: "client-export",
        state: "EXPORTED",
      }),
    ]);
    await expect(repository.syncPending()).resolves.toEqual([]);
    await expect(repository.canLogout()).resolves.toBe(true);
  });

  it("requeues an interrupted sync during restore", async () => {
    const storage = new MemoryJsonStorage();
    const interrupted: OutboxRecord = {
      clientCommandId: "client-1",
      userId: "user-1",
      workspaceId: "workspace-1",
      accountId: "account-1",
      kind: "expense",
      amount: { currency: "VND", minorUnits: "125000" },
      effectiveDate: "2026-09-01",
      description: "Lunch",
      state: "SYNCING",
      attempts: 1,
    };
    await storage.setItem(
      "finwise-cache:user-1:workspace-1:outbox",
      JSON.stringify([interrupted]),
    );
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    const repository = new MobileOutboxRepository(
      "user-1",
      "workspace-1",
      api,
      storage,
    );

    await expect(repository.list()).resolves.toEqual([
      { ...interrupted, state: "QUEUED" },
    ]);
    await expect(
      storage.getItem("finwise-cache:user-1:workspace-1:outbox"),
    ).resolves.toBe(JSON.stringify([{ ...interrupted, state: "QUEUED" }]));
  });

  it("requeues retryable failures before a later sync attempt", async () => {
    const storage = new MemoryJsonStorage();
    let requestCount = 0;
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      fetchImpl: async () => {
        requestCount += 1;
        if (requestCount === 1) throw new Error("offline");
        return new Response(JSON.stringify({ id: "server-1" }), {
          status: 200,
        });
      },
    });
    const repository = new MobileOutboxRepository(
      "user-1",
      "workspace-1",
      api,
      storage,
    );

    await repository.createAndQueue({
      clientCommandId: "client-2",
      userId: "user-1",
      workspaceId: "workspace-1",
      accountId: "account-1",
      kind: "expense",
      amount: { currency: "VND", minorUnits: "9000" },
      effectiveDate: "2026-09-01",
      description: "Retry me",
    });
    await expect(repository.syncPending()).resolves.toEqual([
      expect.objectContaining({ state: "RETRYABLE_FAILURE" }),
    ]);
    await expect(repository.syncPending()).resolves.toEqual([
      expect.objectContaining({
        state: "SYNCED",
        serverTransactionId: "server-1",
      }),
    ]);
    expect(requestCount).toBe(2);
  });
});
