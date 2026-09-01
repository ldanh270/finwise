import type { JsonStorage } from "../sync/outbox-persistence";

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
}));

import { ReceiptStagingStore } from "./receipt-staging";

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

describe("ReceiptStagingStore", () => {
  it("keeps receipt metadata isolated by user and workspace", async () => {
    const storage = new MemoryJsonStorage();
    const first = new ReceiptStagingStore("user-a", "workspace-a", storage);
    const second = new ReceiptStagingStore("user-b", "workspace-a", storage);

    const receipt = await first.stage({
      fileName: "receipt.jpg",
      fileUri: "file:///receipt.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1200,
    });

    await expect(first.list()).resolves.toHaveLength(1);
    await expect(second.list()).resolves.toHaveLength(0);
    await first.remove(receipt.id);
    await expect(first.list()).resolves.toHaveLength(0);
  });

  it("ignores malformed snapshots instead of exposing unsafe metadata", async () => {
    const storage = new MemoryJsonStorage();
    await storage.setItem(
      "finwise-cache:user-a:workspace-a:receipts",
      JSON.stringify([{ fileUri: "file:///missing-id" }]),
    );
    const store = new ReceiptStagingStore("user-a", "workspace-a", storage);
    await expect(store.list()).resolves.toEqual([]);
  });
});
