import type { JsonStorage } from "../sync/outbox-persistence";

/** Best-effort UX preference; current membership is always resolved by Nest. */
export class WorkspaceSelectionStore {
  private readonly key: string;

  constructor(
    userId: string,
    private readonly storage: JsonStorage,
  ) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) throw new Error("userId is required");
    this.key = `finwise-cache:${encodeURIComponent(normalizedUserId)}:selection`;
  }

  async read(): Promise<string | undefined> {
    const value = await this.storage.getItem(this.key);
    const normalized = value?.trim();
    return normalized || undefined;
  }

  async write(workspaceId: string): Promise<void> {
    const normalized = workspaceId.trim();
    if (!normalized) throw new Error("workspaceId is required");
    await this.storage.setItem(this.key, normalized);
  }
}
