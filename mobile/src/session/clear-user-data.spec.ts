import type { PrefixJsonStorage } from "../sync/outbox-persistence";

jest.mock("expo-sqlite", () => ({}));

import { clearUserWorkspaceData, userPartitionPrefix } from "./clear-user-data";

class MemoryPrefixStorage implements PrefixJsonStorage {
  readonly values = new Map<string, string>();

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

  removeByPrefix(prefix: string): Promise<void> {
    for (const key of this.values.keys()) {
      if (key.startsWith(prefix)) this.values.delete(key);
    }
    return Promise.resolve();
  }
}

describe("user workspace cleanup", () => {
  it("removes every workspace key for one user and preserves another", async () => {
    const storage = new MemoryPrefixStorage();
    await storage.setItem("finwise-cache:user-a:workspace-1:reads", "a");
    await storage.setItem("finwise-cache:user-a:workspace-2:outbox", "b");
    await storage.setItem("finwise-cache:user-b:workspace-1:reads", "c");

    await clearUserWorkspaceData("user-a", storage);

    expect([...storage.values.keys()]).toEqual([
      "finwise-cache:user-b:workspace-1:reads",
    ]);
  });

  it("URL-encodes the user partition and rejects blank ids", async () => {
    expect(userPartitionPrefix("user@example.com")).toBe(
      "finwise-cache:user%40example.com:",
    );
    await expect(
      clearUserWorkspaceData("   ", new MemoryPrefixStorage()),
    ).rejects.toThrow("userId is required");
  });
});
