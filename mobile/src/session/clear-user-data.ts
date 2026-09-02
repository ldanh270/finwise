import type { PrefixJsonStorage } from "../sync/outbox-persistence";
import { sqliteJsonStorage } from "../sync/sqlite-storage";

/**
 * Removes cache, outbox, and receipt metadata for every workspace owned by a
 * user. The caller must resolve or explicitly export/discard drafts first.
 */
export async function clearUserWorkspaceData(
  userId: string,
  storage: PrefixJsonStorage = sqliteJsonStorage,
): Promise<void> {
  await storage.removeByPrefix(userPartitionPrefix(userId));
}

export function userPartitionPrefix(userId: string): string {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("userId is required for cleanup");
  return `finwise-cache:${encodeURIComponent(normalizedUserId)}:`;
}
