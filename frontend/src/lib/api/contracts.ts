export type WorkspaceIntent = "PERSONAL" | "SHARED";

export type AccountType = "CASH" | "BANK" | "SAVINGS" | "OTHER";

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

export type MoneyDto = {
  currency: "VND";
  minorUnits: string;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  intent: WorkspaceIntent;
};

export type UserProfile = {
  id: string;
  displayName: string;
};

export type BootstrapResponse = {
  user: UserProfile;
  workspaces: WorkspaceSummary[];
  suggestedWorkspaceId: string | null;
  requestId?: string;
};

export type AccountSummary = {
  id: string;
  name: string;
  type: AccountType;
  balance: MoneyDto;
  isArchived: boolean;
};

export type TransactionSummary = {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: MoneyDto;
  accountName: string;
  categoryName: string | null;
};

export type BudgetSummary = {
  id: string;
  categoryName: string;
  available: MoneyDto;
  actual: MoneyDto;
  remaining: MoneyDto;
};

export type OverviewResponse = {
  workspaceId: string;
  period: string;
  accounts: AccountSummary[];
  recentTransactions: TransactionSummary[];
  budgets: BudgetSummary[];
  totals: {
    accountBalance: MoneyDto;
    budgetRemaining: MoneyDto;
    income: MoneyDto;
    spending: MoneyDto;
  };
  hasPartialAccess?: boolean;
  requestId?: string;
};

export type ApiErrorCode =
  | "API_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "MEMBERSHIP_REQUIRED"
  | "PERMISSION_DENIED"
  | "VALIDATION_FAILED"
  | "VALIDATION_ERROR"
  | "BUSINESS_STATE_INVALID"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  status?: number;
};

export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; error: ApiError };

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    value === "API_NOT_CONFIGURED" ||
    value === "AUTH_REQUIRED" ||
    value === "SESSION_EXPIRED" ||
    value === "MEMBERSHIP_REQUIRED" ||
    value === "PERMISSION_DENIED" ||
    value === "VALIDATION_FAILED" ||
    value === "VALIDATION_ERROR" ||
    value === "BUSINESS_STATE_INVALID" ||
    value === "IDEMPOTENCY_KEY_REQUIRED" ||
    value === "IDEMPOTENCY_KEY_REUSED" ||
    value === "RESOURCE_NOT_FOUND" ||
    value === "CONFLICT" ||
    value === "NETWORK_ERROR" ||
    value === "UNKNOWN_ERROR"
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isMoneyDto(value: unknown): value is MoneyDto {
  return (
    isRecord(value) &&
    value.currency === "VND" &&
    typeof value.minorUnits === "string"
  );
}

export function isWorkspaceSummary(value: unknown): value is WorkspaceSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.intent === "PERSONAL" || value.intent === "SHARED")
  );
}

export function isBootstrapResponse(
  value: unknown,
): value is BootstrapResponse {
  return (
    isRecord(value) &&
    isRecord(value.user) &&
    typeof value.user.id === "string" &&
    typeof value.user.displayName === "string" &&
    Array.isArray(value.workspaces) &&
    value.workspaces.every(isWorkspaceSummary) &&
    (typeof value.suggestedWorkspaceId === "string" ||
      value.suggestedWorkspaceId === null)
  );
}

export function isOverviewResponse(value: unknown): value is OverviewResponse {
  return (
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.period === "string" &&
    Array.isArray(value.accounts) &&
    Array.isArray(value.recentTransactions) &&
    Array.isArray(value.budgets) &&
    isRecord(value.totals) &&
    isMoneyDto(value.totals.accountBalance) &&
    isMoneyDto(value.totals.budgetRemaining) &&
    isMoneyDto(value.totals.income) &&
    isMoneyDto(value.totals.spending)
  );
}
