import type { TransactionSummary } from "@finwise/api-client";

/**
 * Filters only the already-authorized transaction snapshot. Search never
 * widens server visibility and therefore cannot expose another account or
 * workspace through a client-side query.
 */
export function filterTransactions(
  transactions: readonly TransactionSummary[],
  query: string,
): readonly TransactionSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return transactions;

  return transactions.filter((transaction) =>
    [
      transaction.description,
      transaction.kind,
      transaction.status,
      transaction.effectiveDate,
      transaction.id,
      transaction.amount.minorUnits,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)),
  );
}
