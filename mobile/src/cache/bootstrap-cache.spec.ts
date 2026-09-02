import type { BootstrapResponse } from "@finwise/api-client";
import type { JsonStorage } from "../sync/outbox-persistence";
import { BootstrapCache } from "./bootstrap-cache";

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

const bootstrap: BootstrapResponse = {
  user: { id: "user-1", email: "one@example.test", displayName: "One" },
  workspaces: [{ id: "workspace-1", name: "Personal", intent: "PERSONAL" }],
  suggestedWorkspaceId: "workspace-1",
};

describe("BootstrapCache", () => {
  it("round-trips a validated user bootstrap snapshot", async () => {
    const storage = new MemoryJsonStorage();
    const cache = new BootstrapCache("user-1", storage);

    await cache.write(bootstrap);

    await expect(cache.read()).resolves.toEqual({
      savedAt: expect.any(String),
      value: bootstrap,
    });
  });

  it("does not read another user's partition", async () => {
    const storage = new MemoryJsonStorage();
    await new BootstrapCache("user-1", storage).write(bootstrap);

    await expect(new BootstrapCache("user-2", storage).read()).resolves.toBe(
      null,
    );
  });

  it("rejects a snapshot whose user identity does not match its partition", async () => {
    const storage = new MemoryJsonStorage();
    await storage.setItem(
      "finwise-cache:user-1:bootstrap",
      JSON.stringify({
        savedAt: new Date().toISOString(),
        value: { ...bootstrap, user: { ...bootstrap.user, id: "user-2" } },
      }),
    );

    await expect(new BootstrapCache("user-1", storage).read()).resolves.toBe(
      null,
    );
  });

  it("rejects malformed snapshots instead of treating them as authorization", async () => {
    const storage = new MemoryJsonStorage();
    await storage.setItem(
      "finwise-cache:user-1:bootstrap",
      JSON.stringify({
        savedAt: new Date().toISOString(),
        value: { user: {} },
      }),
    );

    await expect(new BootstrapCache("user-1", storage).read()).resolves.toBe(
      null,
    );
  });
});
