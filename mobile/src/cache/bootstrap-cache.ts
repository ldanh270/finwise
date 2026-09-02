import type { BootstrapResponse } from "@finwise/api-client";
import type { JsonStorage } from "../sync/outbox-persistence";

export type CachedBootstrap = {
  readonly savedAt: string;
  readonly value: BootstrapResponse;
};

/**
 * Stores only the last server-authorized workspace list for one user. This is
 * a stale-read fallback; it never grants authorization to a mutation.
 */
export class BootstrapCache {
  private readonly key: string;
  private readonly userId: string;

  constructor(
    userId: string,
    private readonly storage: JsonStorage,
  ) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) throw new Error("userId is required");
    this.userId = normalizedUserId;
    this.key = `finwise-cache:${encodeURIComponent(normalizedUserId)}:bootstrap`;
  }

  async read(): Promise<CachedBootstrap | null> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || typeof parsed.savedAt !== "string") return null;
      if (!isBootstrapResponse(parsed.value)) return null;
      if (parsed.value.user.id !== this.userId) return null;
      return { savedAt: parsed.savedAt, value: parsed.value };
    } catch {
      return null;
    }
  }

  async write(value: BootstrapResponse): Promise<void> {
    await this.storage.setItem(
      this.key,
      JSON.stringify({ savedAt: new Date().toISOString(), value }),
    );
  }
}

function isBootstrapResponse(value: unknown): value is BootstrapResponse {
  if (
    !isRecord(value) ||
    !isRecord(value.user) ||
    !Array.isArray(value.workspaces)
  ) {
    return false;
  }
  if (
    typeof value.user.id !== "string" ||
    typeof value.user.email !== "string" ||
    typeof value.user.displayName !== "string"
  ) {
    return false;
  }
  if (
    value.suggestedWorkspaceId !== null &&
    typeof value.suggestedWorkspaceId !== "string"
  ) {
    return false;
  }
  return value.workspaces.every(isWorkspaceSummary);
}

function isWorkspaceSummary(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.intent === "PERSONAL" || value.intent === "SHARED")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
