import { stableCommandKey } from "./stable-command-key";

describe("stableCommandKey", () => {
  it("reuses a key for the same payload and rotates when the payload changes", () => {
    const first = stableCommandKey(undefined, "transaction", {
      amountMinorUnits: "1000",
      accountId: "account-1",
    });
    const same = stableCommandKey(first.state, "transaction", {
      amountMinorUnits: "1000",
      accountId: "account-1",
    });
    const changed = stableCommandKey(first.state, "transaction", {
      amountMinorUnits: "2000",
      accountId: "account-1",
    });

    expect(same.key).toBe(first.key);
    expect(changed.key).not.toBe(first.key);
    expect(changed.key.startsWith("transaction-")).toBe(true);
  });
});
