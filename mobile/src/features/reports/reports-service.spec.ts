import type { FinwiseApiClient, ReportsResponse } from "@finwise/api-client";
import { getReports } from "./reports-service";

describe("reports service", () => {
  it("passes the selected workspace and month range to the shared client", async () => {
    const response = {} as ReportsResponse;
    const getReportsMock = jest.fn().mockResolvedValue(response);
    const api = { getReports: getReportsMock } as unknown as FinwiseApiClient;

    await expect(
      getReports(api, "workspace-1", {
        fromMonth: "2026-01",
        toMonth: "2026-06",
      }),
    ).resolves.toBe(response);
    expect(getReportsMock).toHaveBeenCalledWith("workspace-1", {
      fromMonth: "2026-01",
      toMonth: "2026-06",
    });
  });
});
