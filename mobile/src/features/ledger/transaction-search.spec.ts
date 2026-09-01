import type { TransactionSummary } from "@finwise/api-client";
import { filterTransactions } from "./transaction-search";

const transactions: readonly TransactionSummary[] = [
  {
    id: "salary-1",
    workspaceId: "workspace-1",
    kind: "income",
    status: "posted",
    amount: { currency: "VND", minorUnits: "1000000" },
    effectiveDate: "2026-09-01",
    recordedAt: "2026-09-01T08:00:00.000Z",
    description: "September salary",
  },
  {
    id: "lunch-1",
    workspaceId: "workspace-1",
    kind: "expense",
    status: "posted",
    amount: { currency: "VND", minorUnits: "125000" },
    effectiveDate: "2026-09-02",
    recordedAt: "2026-09-02T12:00:00.000Z",
    description: "Lunch",
  },
];

describe("filterTransactions", () => {
  it("returns the authorized snapshot unchanged for an empty query", () => {
    expect(filterTransactions(transactions, "  ")).toBe(transactions);
  });

  it("matches description and kind without changing transaction order", () => {
    expect(
      filterTransactions(transactions, "SALARY").map(({ id }) => id),
    ).toEqual(["salary-1"]);
    expect(
      filterTransactions(transactions, "expense").map(({ id }) => id),
    ).toEqual(["lunch-1"]);
  });

  it("matches dates and exact minor-unit amounts", () => {
    expect(
      filterTransactions(transactions, "2026-09-02").map(({ id }) => id),
    ).toEqual(["lunch-1"]);
    expect(
      filterTransactions(transactions, "1000000").map(({ id }) => id),
    ).toEqual(["salary-1"]);
  });
});
