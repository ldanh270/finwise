import type { JsonStorage } from "../sync/outbox-persistence";
import { WorkspaceSelectionStore } from "./workspace-selection";

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

describe("WorkspaceSelectionStore", () => {
  it("persists a selected workspace in the user partition", async () => {
    const storage = new MemoryJsonStorage();
    const first = new WorkspaceSelectionStore("user-1", storage);

    await first.write("workspace-2");

    await expect(
      new WorkspaceSelectionStore("user-1", storage).read(),
    ).resolves.toBe("workspace-2");
  });

  it("does not share a preference between users", async () => {
    const storage = new MemoryJsonStorage();
    await new WorkspaceSelectionStore("user-1", storage).write("workspace-1");

    await expect(
      new WorkspaceSelectionStore("user-2", storage).read(),
    ).resolves.toBeUndefined();
  });

  it("ignores blank values and rejects blank writes", async () => {
    const storage = new MemoryJsonStorage();
    await storage.setItem("finwise-cache:user-1:selection", "   ");
    const store = new WorkspaceSelectionStore("user-1", storage);

    await expect(store.read()).resolves.toBeUndefined();
    await expect(store.write("  ")).rejects.toThrow("workspaceId is required");
  });
});
