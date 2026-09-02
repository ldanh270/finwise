import {
  classificationError,
  replacementDraft,
  replacementType,
} from "./transaction-detail";

describe("transaction detail rules", () => {
  it("requires positive classification lines to exactly match the ledger amount", () => {
    const lines = [
      { categoryId: "food", amountMinorUnits: "12500", tagIds: [] },
      { categoryId: "home", amountMinorUnits: "7500", tagIds: [] },
    ];
    expect(classificationError(lines, "20000")).toBeNull();
    expect(classificationError(lines, "19000")).toContain("19000");
    expect(
      classificationError(
        [{ categoryId: "food", amountMinorUnits: "0", tagIds: [] }],
        "0",
      ),
    ).toContain("positive");
  });

  it("rejects malformed or incomplete classification lines", () => {
    expect(
      classificationError(
        [{ categoryId: "", amountMinorUnits: "100", tagIds: [] }],
        "100",
      ),
    ).toContain("category");
    expect(
      classificationError(
        [{ categoryId: "food", amountMinorUnits: "10.5", tagIds: [] }],
        "10",
      ),
    ).toContain("whole VND");
  });

  it("only allows replacement for income, expense, and transfer journals", () => {
    expect(replacementType({ kind: "income" })).toBe("income");
    expect(replacementType({ kind: "opening_balance" })).toBeNull();
    expect(
      replacementDraft({
        kind: "transfer",
        amount: { currency: "VND", minorUnits: "250000" },
        effectiveDate: "2026-09-02",
        description: "Move",
        entries: [
          {
            id: "entry-1",
            accountId: "cash",
            amountMinorUnits: "250000",
            direction: "decrease",
          },
          {
            id: "entry-2",
            accountId: "bank",
            amountMinorUnits: "250000",
            direction: "increase",
          },
        ],
      }),
    ).toEqual({
      type: "transfer",
      amountMinorUnits: "250000",
      accountId: "cash",
      destinationAccountId: "bank",
      effectiveDate: "2026-09-02",
      description: "Move",
    });
  });
});
