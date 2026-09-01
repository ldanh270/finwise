import type { BootstrapResponse } from "@finwise/api-client";
import {
  getWorkspaceBootstrapStatus,
  type WorkspaceBootstrapStatus,
} from "./workspace-bootstrap";

const user = {
  id: "user-1",
  email: "user@example.com",
  displayName: "Finwise User",
};

function bootstrap(
  workspaces: BootstrapResponse["workspaces"],
): BootstrapResponse {
  return { user, workspaces, suggestedWorkspaceId: workspaces[0]?.id ?? null };
}

describe("workspace bootstrap readiness", () => {
  it.each([
    [undefined, false, "loading"],
    [undefined, true, "error"],
    [bootstrap([]), false, "empty"],
    [
      bootstrap([{ id: "workspace-1", name: "Personal", intent: "PERSONAL" }]),
      false,
      "ready",
    ],
  ] as const)(
    "maps the query state to %s",
    (
      response: BootstrapResponse | undefined,
      hasError: boolean,
      expected: WorkspaceBootstrapStatus,
    ) => {
      expect(getWorkspaceBootstrapStatus(response, hasError)).toBe(expected);
    },
  );
});
