import { createHttpFinwiseApi } from "../../lib/api/client";
import type { ApiResult, AccountSummary } from "../../lib/api/contracts";

const api = createHttpFinwiseApi();

export function createAccount(
  workspaceId: string,
  input: { name: string; kind: "cash" | "bank" | "savings" | "other" },
): Promise<ApiResult<Record<string, unknown>>> {
  return api.createAccount(workspaceId, input);
}

export function postOpeningBalance(
  workspaceId: string,
  accountId: string,
  input: {
    amountMinorUnits: string;
    effectiveDate: string;
    description?: string;
  },
): Promise<ApiResult<Record<string, unknown>>> {
  return api.postOpeningBalance(
    workspaceId,
    accountId,
    input,
    commandKey("opening-balance"),
  );
}

export function createTransaction(
  workspaceId: string,
  input: {
    type: "income" | "expense" | "transfer";
    amountMinorUnits: string;
    accountId: string;
    destinationAccountId?: string;
    effectiveDate: string;
    description?: string;
  },
): Promise<ApiResult<Record<string, unknown>>> {
  return api.createTransaction(workspaceId, input, commandKey("transaction"));
}

export function voidTransaction(
  workspaceId: string,
  transactionId: string,
  input: { reason: string; effectiveDate: string },
): Promise<ApiResult<Record<string, unknown>>> {
  return api.voidTransaction(
    workspaceId,
    transactionId,
    input,
    commandKey(`void-${transactionId}`),
  );
}

export function accountOptions(
  accounts: readonly AccountSummary[],
): AccountSummary[] {
  return accounts.filter((account) => !account.isArchived);
}

function commandKey(scope: string): string {
  return `web-${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
