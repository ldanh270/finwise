import type {
  AccountSummary,
  CategorySummary,
  ClassificationLineSummary,
  FinwiseApiClient,
  JournalSourceLinkSummary,
  TransactionAuditSummary,
  TransactionSummary,
  TagSummary,
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

export function listCategories(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly CategorySummary[]> {
  return api.getCategories(workspaceId);
}

export function listTags(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly TagSummary[]> {
  return api.getTags(workspaceId);
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

export function getTransaction(
  api: FinwiseApiClient,
  workspaceId: string,
  transactionId: string,
): Promise<TransactionSummary> {
  return api.getTransaction(workspaceId, transactionId);
}

export function getTransactionClassification(
  api: FinwiseApiClient,
  workspaceId: string,
  transactionId: string,
): Promise<readonly ClassificationLineSummary[]> {
  return api.getTransactionClassification(workspaceId, transactionId);
}

export function classifyTransaction(
  api: FinwiseApiClient,
  workspaceId: string,
  transactionId: string,
  input: {
    readonly lines: readonly {
      readonly categoryId: string;
      readonly amountMinorUnits: string;
      readonly tagIds?: readonly string[];
    }[];
  },
): Promise<readonly ClassificationLineSummary[]> {
  return api.classifyTransaction(workspaceId, transactionId, input);
}

export function replaceTransaction(
  api: FinwiseApiClient,
  workspaceId: string,
  transactionId: string,
  input: {
    readonly reason: string;
    readonly type: "income" | "expense" | "transfer";
    readonly amountMinorUnits: string;
    readonly accountId: string;
    readonly destinationAccountId?: string;
    readonly effectiveDate: string;
    readonly description?: string;
  },
  idempotencyKey: string,
): ReturnType<FinwiseApiClient["replaceTransaction"]> {
  return api.replaceTransaction(
    workspaceId,
    transactionId,
    input,
    idempotencyKey,
  );
}

export function getTransactionAudits(
  api: FinwiseApiClient,
  workspaceId: string,
  transactionId: string,
): Promise<readonly TransactionAuditSummary[]> {
  return api.getTransactionAudits(workspaceId, transactionId);
}

export function getTransactionSourceLinks(
  api: FinwiseApiClient,
  workspaceId: string,
  transactionId: string,
): Promise<readonly JournalSourceLinkSummary[]> {
  return api.getTransactionSourceLinks(workspaceId, transactionId);
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
