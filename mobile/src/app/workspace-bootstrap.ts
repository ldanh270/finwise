import type { BootstrapResponse } from "@finwise/api-client";

export type WorkspaceBootstrapStatus = "loading" | "ready" | "empty" | "error";

export function getWorkspaceBootstrapStatus(
  bootstrap: BootstrapResponse | undefined,
  hasError: boolean,
): WorkspaceBootstrapStatus {
  if (bootstrap) return bootstrap.workspaces.length > 0 ? "ready" : "empty";
  return hasError ? "error" : "loading";
}
