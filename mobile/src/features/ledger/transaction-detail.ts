import type { TransactionSummary } from "@finwise/api-client";

export type ClassificationDraftLine = {
  readonly budgetId: string;
  readonly amountMinorUnits: string;
  readonly tagIds: readonly string[];
};

export type ReplacementDraft = {
  readonly type: "income" | "expense" | "transfer";
  readonly amountMinorUnits: string;
  readonly accountId: string;
  readonly destinationAccountId: string;
  readonly effectiveDate: string;
  readonly description: string;
};

export function classificationError(
  lines: readonly ClassificationDraftLine[],
  transactionAmountMinorUnits: string,
): string | null {
  if (lines.length === 0) return "Add at least one budget line.";
  let total = 0n;
  for (const line of lines) {
    if (!line.budgetId) return "Choose a budget for every line.";
    if (!/^\d+$/.test(line.amountMinorUnits))
      return "Amounts must be whole VND minor units.";
    const amount = BigInt(line.amountMinorUnits);
    if (amount <= 0n) return "Every budget line must be positive.";
    total += amount;
  }
  if (!/^\d+$/.test(transactionAmountMinorUnits))
    return "The transaction amount is invalid.";
  if (total !== BigInt(transactionAmountMinorUnits))
    return `Budget lines must total ${transactionAmountMinorUnits} minor units.`;
  return null;
}

export function replacementType(
  transaction: Pick<TransactionSummary, "kind">,
): ReplacementDraft["type"] | null {
  if (transaction.kind === "income") return "income";
  if (transaction.kind === "expense") return "expense";
  if (transaction.kind === "transfer") return "transfer";
  return null;
}

export function replacementDraft(
  transaction: Pick<
    TransactionSummary,
    "kind" | "amount" | "effectiveDate" | "description" | "entries"
  >,
): ReplacementDraft | null {
  const type = replacementType(transaction);
  if (!type) return null;
  const [source, destination] = transaction.entries ?? [];
  return {
    type,
    amountMinorUnits: transaction.amount.minorUnits,
    accountId: source?.accountId ?? "",
    destinationAccountId: destination?.accountId ?? "",
    effectiveDate: transaction.effectiveDate,
    description: transaction.description ?? "",
  };
}
