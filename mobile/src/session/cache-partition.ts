export interface CachePartition {
  readonly userId: string;
  readonly workspaceId: string;
  readonly key: string;
}

export function createCachePartition(
  userId: string,
  workspaceId: string,
): CachePartition {
  const normalizedUserId = requirePartitionValue(userId, "userId");
  const normalizedWorkspaceId = requirePartitionValue(
    workspaceId,
    "workspaceId",
  );
  return {
    userId: normalizedUserId,
    workspaceId: normalizedWorkspaceId,
    key: `finwise-cache:${encodeURIComponent(normalizedUserId)}:${encodeURIComponent(normalizedWorkspaceId)}`,
  };
}

function requirePartitionValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized)
    throw new Error(`${field} is required for a cache partition`);
  return normalized;
}
