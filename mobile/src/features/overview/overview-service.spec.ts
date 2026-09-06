import { getOverviewAccountBalances } from "./overview-service";

describe("getOverviewAccountBalances", () => {
  it("returns an empty list for an overview snapshot without currency balances", () => {
    expect(getOverviewAccountBalances({})).toEqual([]);
  });
});
