import type { BootstrapResponse } from "@finwise/api-client";

export type WorkspaceBootstrapStatus = "loading" | "ready" | "empty" | "error";

export function getWorkspaceBootstrapStatus(
  bootstrap: BootstrapResponse | undefined,
  hasError: boolean,
): WorkspaceBootstrapStatus {
  if (bootstrap) return bootstrap.workspaces.length > 0 ? "ready" : "empty";
  return hasError ? "error" : "loading";
}

export function resolveWorkspaceId(
  bootstrap: BootstrapResponse | undefined,
  selectedWorkspaceId?: string,
): string | undefined {
  if (!bootstrap) return undefined;
  const selectedIsAuthorized = bootstrap.workspaces.some(
    (workspace) => workspace.id === selectedWorkspaceId,
  );
  if (selectedIsAuthorized) return selectedWorkspaceId;
  return bootstrap.suggestedWorkspaceId ?? bootstrap.workspaces[0]?.id;
}
