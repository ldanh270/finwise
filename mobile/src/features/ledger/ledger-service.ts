import type {
  AccountSummary,
  FinwiseApiClient,
  TransactionSummary,
} from "@finwise/api-client";

/**
 * Mobile ledger boundary. Routes provide presentation state and navigation;
 * this module owns the transport calls used by account and transaction
 * screens so the UI does not depend on HTTP details.
 */
export function listAccounts(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly AccountSummary[]> {
  return api.getAccounts(workspaceId);
}

export function createAccount(
  api: FinwiseApiClient,
  workspaceId: string,
  input: {
    readonly name: string;
    readonly kind: AccountSummary["kind"];
  },
): Promise<AccountSummary> {
  return api.createAccount(workspaceId, input);
}

export function postOpeningBalance(
  api: FinwiseApiClient,
  workspaceId: string,
  accountId: string,
  input: {
    readonly amountMinorUnits: string;
    readonly effectiveDate: string;
  },
  idempotencyKey: string,
): Promise<TransactionSummary> {
  return api.postOpeningBalance(workspaceId, accountId, input, idempotencyKey);
}

export function listTransactions(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly TransactionSummary[]> {
  return api.getTransactions(workspaceId);
}

export function createTransaction(
  api: FinwiseApiClient,
  workspaceId: string,
  input: {
    readonly type: "income" | "expense" | "transfer";
    readonly amountMinorUnits: string;
    readonly accountId: string;
    readonly destinationAccountId?: string;
    readonly effectiveDate: string;
    readonly description?: string;
  },
  idempotencyKey: string,
): Promise<TransactionSummary> {
  return api.createTransaction(workspaceId, input, idempotencyKey);
}

export function voidTransaction(
  api: FinwiseApiClient,
  workspaceId: string,
  transactionId: string,
  input: { readonly reason: string; readonly effectiveDate: string },
  idempotencyKey: string,
): ReturnType<FinwiseApiClient["voidTransaction"]> {
  return api.voidTransaction(workspaceId, transactionId, input, idempotencyKey);
}

export function exportTransactions(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<string> {
  return api.exportTransactions(workspaceId);
}
