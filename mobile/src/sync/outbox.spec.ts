import {
  ManualDraftOutbox,
  InMemoryOutboxStore,
  idempotencyKeyFor,
} from "./outbox";
import { ApiManualDraftSync } from "./online-sync";
import { PersistentOutboxSnapshot, type JsonStorage } from "./outbox-persistence";

describe("ManualDraftOutbox", () => {
  function createDraft() {
    return {
      clientCommandId: "client-1",
      userId: "user-1",
      workspaceId: "workspace-1",
      accountId: "account-1",
      kind: "expense" as const,
      amount: { currency: "VND" as const, minorUnits: "125000" },
      effectiveDate: "2026-08-31",
      description: "Lunch",
    };
  }

  it("reuses the same draft and idempotency key across retries", () => {
    const outbox = new ManualDraftOutbox(new InMemoryOutboxStore());
    const created = outbox.create(createDraft());
    expect(outbox.create(createDraft()).clientCommandId).toBe(
      created.clientCommandId,
    );
    expect(idempotencyKeyFor(created.clientCommandId)).toBe("client-1");
    outbox.queue("client-1");
    outbox.beginSync("client-1");
    outbox.markRetryableFailure("client-1", "NETWORK_ERROR");
    expect(outbox.canLogout("user-1", "workspace-1")).toBe(false);
    outbox.queue("client-1");
    outbox.beginSync("client-1");
    outbox.markSynced("client-1", "server-1");
    expect(outbox.canLogout("user-1", "workspace-1")).toBe(true);
  });

  it("rejects a different command reusing an existing client id", () => {
    const outbox = new ManualDraftOutbox(new InMemoryOutboxStore());
    outbox.create(createDraft());
    expect(() =>
      outbox.create({
        ...createDraft(),
        amount: { currency: "VND", minorUnits: "2" },
      }),
    ).toThrow("clientCommandId was already used");
  });

  it("posts queued drafts with the stable idempotency key and records the server id", async () => {
    const outbox = new ManualDraftOutbox(new InMemoryOutboxStore());
    outbox.create(createDraft());
    outbox.queue("client-1");
    const calls: Array<{ commandId: string; idempotencyKey: string }> = [];

    const synced = await outbox.sync("client-1", {
      async postManualTransaction(command, idempotencyKey) {
        calls.push({
          commandId: command.clientCommandId,
          idempotencyKey,
        });
        return { transactionId: "server-1" };
      },
    });

    expect(calls).toEqual([
      { commandId: "client-1", idempotencyKey: "client-1" },
    ]);
    expect(synced.state).toBe("SYNCED");
    expect(synced.serverTransactionId).toBe("server-1");
    expect(outbox.pendingCount("user-1", "workspace-1")).toBe(0);
  });

  it("keeps transient failures retryable and conflicts actionable", async () => {
    const outbox = new ManualDraftOutbox(new InMemoryOutboxStore());
    outbox.create(createDraft());
    outbox.queue("client-1");
    const retryable = await outbox.sync("client-1", {
      async postManualTransaction() {
        throw new Error("offline");
      },
    });
    expect(retryable.state).toBe("RETRYABLE_FAILURE");
    expect(retryable.lastErrorCode).toBe("NETWORK_ERROR");

    outbox.queue("client-1");
    const actionable = await outbox.sync("client-1", {
      async postManualTransaction() {
        throw { code: "CONFLICT" };
      },
    });
    expect(actionable.state).toBe("NEEDS_USER_ACTION");
    expect(actionable.lastErrorCode).toBe("CONFLICT");
  });

  it("adapts the generated client shape without changing the draft contract", async () => {
    const calls: unknown[] = [];
    const sync = new ApiManualDraftSync({
      async postManualTransaction(workspaceId, input, idempotencyKey) {
        calls.push({ workspaceId, input, idempotencyKey });
        return { id: "server-2" };
      },
    });
    await expect(sync.postManualTransaction(createDraft(), "client-1")).resolves.toEqual({
      transactionId: "server-2",
    });
    expect(calls).toEqual([
      {
        workspaceId: "workspace-1",
        input: {
          type: "expense",
          accountId: "account-1",
          amount: { currency: "VND", minorUnits: "125000" },
          effectiveDate: "2026-08-31",
          description: "Lunch",
        },
        idempotencyKey: "client-1",
      },
    ]);
  });

  it("restores a user/workspace snapshot after process restart", async () => {
    const values = new Map<string, string>();
    const storage: JsonStorage = {
      async getItem(key) {
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        values.set(key, value);
      },
      async removeItem(key) {
        values.delete(key);
      },
    };
    const key = "finwise-cache:user-1:workspace-1:outbox";
    const firstStore = new InMemoryOutboxStore();
    const firstOutbox = new ManualDraftOutbox(firstStore);
    firstOutbox.create(createDraft());
    firstOutbox.queue("client-1");
    const snapshot = new PersistentOutboxSnapshot(storage, key);
    await snapshot.save(firstStore, "user-1", "workspace-1");

    const restoredStore = new InMemoryOutboxStore();
    await expect(snapshot.load(restoredStore)).resolves.toBe(1);
    expect(restoredStore.find("client-1")?.state).toBe("QUEUED");
    expect(restoredStore.find("client-1")?.amount.minorUnits).toBe("125000");
  });
});
