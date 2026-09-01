/**
 * Workspace-scoped query keys use the workspace ID in the second segment.
 * Bootstrap is intentionally global and must survive a workspace switch.
 */
export function isWorkspaceQueryFor(
  queryKey: readonly unknown[],
  workspaceId: string,
): boolean {
  return queryKey[1] === workspaceId;
}
