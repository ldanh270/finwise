import { isWorkspaceQueryFor } from "./workspace-query-scope";

describe("isWorkspaceQueryFor", () => {
  it("matches the workspace segment used by feature query keys", () => {
    expect(
      isWorkspaceQueryFor(["overview", "workspace-a"], "workspace-a"),
    ).toBe(true);
    expect(
      isWorkspaceQueryFor(["transactions", "workspace-b"], "workspace-a"),
    ).toBe(false);
  });

  it("does not treat the global bootstrap query as workspace data", () => {
    expect(isWorkspaceQueryFor(["bootstrap"], "workspace-a")).toBe(false);
  });
});
