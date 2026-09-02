export type WorkspaceIntent = "PERSONAL" | "SHARED";

export type AccountType = "CASH" | "BANK" | "SAVINGS" | "OTHER";

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
export type TransactionStatus = "posted" | "voided";

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

export type BalanceViewSummary = {
  accountId: string;
  ledger: MoneyDto;
  cleared: MoneyDto;
  reconciled: MoneyDto;
};

export type TransactionSummary = {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  status: TransactionStatus;
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

export type CategorySummary = {
  id: string;
  workspaceId: string;
  name: string;
  parentId?: string;
  status: string;
};

export type TagSummary = {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
};

export type BudgetPeriodSummary = {
  id: string;
  workspaceId: string;
  month: string;
  base: MoneyDto;
  carry: MoneyDto;
  status: string;
};

export type BudgetConstraintSummary = {
  categoryId: string;
  mode: string;
  fixed: MoneyDto;
  percentageBasisPoints: number;
  rolloverMode: string;
  allocated: MoneyDto;
  actual: MoneyDto;
  remaining: MoneyDto;
};

export type BudgetOverviewSummary = BudgetPeriodSummary & {
  constraints: BudgetConstraintSummary[];
  totals: {
    allocated: MoneyDto;
    actual: MoneyDto;
    remaining: MoneyDto;
  };
};

export type GroupCollectionSummary = {
  id: string;
  workspaceId: string;
  name: string;
  createdByMemberId: string;
  status: string;
};

export type GroupCollectionProgress = {
  collectionId: string;
  total: MoneyDto;
  paid: MoneyDto;
  outstanding: MoneyDto;
  participantCount: number;
  completedParticipants: number;
};

export type GroupDirectExpense = {
  id: string;
  workspaceId: string;
  accountId: string;
  amount: MoneyDto;
  description: string;
  journalTransactionId: string;
  createdByMemberId: string;
  createdAt: string;
};

export type GroupReportSummary = {
  collectionExpected: MoneyDto;
  collectionReceived: MoneyDto;
  collectionOutstanding: MoneyDto;
  directExpense: MoneyDto;
  approvedClaimExpense: MoneyDto;
  sponsoredValue: MoneyDto;
  openPayable: MoneyDto;
  pendingSubmissionCount: number;
  pendingSubmissionAmount: MoneyDto;
};

export type ImportSessionSummary = {
  id: string;
  workspaceId: string;
  accountId: string;
  fileName: string;
  fileHash: string;
  rawSizeBytes: number;
  rawDeletedAt?: string;
  status: string;
  createdAt: string;
};

export type ImportedRecordSummary = {
  id: string;
  sessionId: string;
  workspaceId: string;
  accountId: string;
  effectiveDate: string;
  amount: MoneyDto;
  type: string;
  description: string;
  sourceKey: string;
  status: string;
  matchedTransactionId?: string;
  confirmedTransactionId?: string;
  decisionReason?: string;
};

export type ReconciliationSummary = {
  id: string;
  workspaceId: string;
  accountId: string;
  statementDate: string;
  externalBalance: MoneyDto;
  ledgerBalance: MoneyDto;
  difference: MoneyDto;
  status: string;
  adjustmentTransactionId?: string;
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

export type ReportMoneySummary = {
  income: MoneyDto;
  spending: MoneyDto;
  net: MoneyDto;
};

export type ReportMonthSummary = ReportMoneySummary & {
  month: string;
};

export type ReportCategorySummary = ReportMoneySummary & {
  categoryId: string | null;
  name: string;
};

export type ReportsResponse = {
  workspaceId: string;
  fromMonth: string;
  toMonth: string;
  totals: ReportMoneySummary;
  monthly: ReportMonthSummary[];
  categories: ReportCategorySummary[];
  hasPartialAccess?: boolean;
};

export type ApiErrorCode =
  | "API_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_ACCOUNT_LOCKED"
  | "AUTH_CONFIGURATION"
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
    value === "AUTH_INVALID_CREDENTIALS" ||
    value === "AUTH_ACCOUNT_LOCKED" ||
    value === "AUTH_CONFIGURATION" ||
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

export function isGroupCollectionSummary(
  value: unknown,
): value is GroupCollectionSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.name === "string" &&
    typeof value.createdByMemberId === "string" &&
    typeof value.status === "string"
  );
}

export function isGroupCollectionProgress(
  value: unknown,
): value is GroupCollectionProgress {
  return (
    isRecord(value) &&
    typeof value.collectionId === "string" &&
    isMoneyDto(value.total) &&
    isMoneyDto(value.paid) &&
    isMoneyDto(value.outstanding) &&
    typeof value.participantCount === "number" &&
    typeof value.completedParticipants === "number"
  );
}

export function isGroupDirectExpense(
  value: unknown,
): value is GroupDirectExpense {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.accountId === "string" &&
    isMoneyDto(value.amount) &&
    typeof value.description === "string" &&
    typeof value.journalTransactionId === "string" &&
    typeof value.createdByMemberId === "string" &&
    typeof value.createdAt === "string"
  );
}

export function isGroupReportSummary(
  value: unknown,
): value is GroupReportSummary {
  return (
    isRecord(value) &&
    isMoneyDto(value.collectionExpected) &&
    isMoneyDto(value.collectionReceived) &&
    isMoneyDto(value.collectionOutstanding) &&
    isMoneyDto(value.directExpense) &&
    isMoneyDto(value.approvedClaimExpense) &&
    isMoneyDto(value.sponsoredValue) &&
    isMoneyDto(value.openPayable) &&
    typeof value.pendingSubmissionCount === "number" &&
    isMoneyDto(value.pendingSubmissionAmount)
  );
}

export function isImportSessionSummary(
  value: unknown,
): value is ImportSessionSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.accountId === "string" &&
    typeof value.fileName === "string" &&
    typeof value.fileHash === "string" &&
    typeof value.rawSizeBytes === "number" &&
    (value.rawDeletedAt === undefined ||
      typeof value.rawDeletedAt === "string") &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string"
  );
}

export function isImportedRecordSummary(
  value: unknown,
): value is ImportedRecordSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.accountId === "string" &&
    typeof value.effectiveDate === "string" &&
    isMoneyDto(value.amount) &&
    typeof value.type === "string" &&
    typeof value.description === "string" &&
    typeof value.sourceKey === "string" &&
    typeof value.status === "string"
  );
}

export function isReconciliationSummary(
  value: unknown,
): value is ReconciliationSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.accountId === "string" &&
    typeof value.statementDate === "string" &&
    isMoneyDto(value.externalBalance) &&
    isMoneyDto(value.ledgerBalance) &&
    isMoneyDto(value.difference) &&
    typeof value.status === "string"
  );
}

export function isCategorySummary(value: unknown): value is CategorySummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.name === "string" &&
    (value.parentId === undefined || typeof value.parentId === "string") &&
    typeof value.status === "string"
  );
}

export function isTagSummary(value: unknown): value is TagSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.name === "string" &&
    typeof value.status === "string"
  );
}

export function isBudgetPeriodSummary(
  value: unknown,
): value is BudgetPeriodSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspaceId === "string" &&
    typeof value.month === "string" &&
    isMoneyDto(value.base) &&
    isMoneyDto(value.carry) &&
    typeof value.status === "string"
  );
}

export function isBudgetOverviewSummary(
  value: unknown,
): value is BudgetOverviewSummary {
  if (!isBudgetPeriodSummary(value)) return false;
  const overview = value as BudgetOverviewSummary;
  return (
    Array.isArray(overview.constraints) &&
    overview.constraints.every(isBudgetConstraintSummary) &&
    isRecord(overview.totals) &&
    isMoneyDto(overview.totals.allocated) &&
    isMoneyDto(overview.totals.actual) &&
    isMoneyDto(overview.totals.remaining)
  );
}

function isBudgetConstraintSummary(
  value: unknown,
): value is BudgetConstraintSummary {
  return (
    isRecord(value) &&
    typeof value.categoryId === "string" &&
    typeof value.mode === "string" &&
    isMoneyDto(value.fixed) &&
    typeof value.percentageBasisPoints === "number" &&
    typeof value.rolloverMode === "string" &&
    isMoneyDto(value.allocated) &&
    isMoneyDto(value.actual) &&
    isMoneyDto(value.remaining)
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

function isReportMoneySummary(value: unknown): value is ReportMoneySummary {
  return (
    isRecord(value) &&
    isMoneyDto(value.income) &&
    isMoneyDto(value.spending) &&
    isMoneyDto(value.net)
  );
}

function isReportMonthSummary(value: unknown): value is ReportMonthSummary {
  return (
    isRecord(value) &&
    typeof value.month === "string" &&
    isReportMoneySummary(value)
  );
}

function isReportCategorySummary(
  value: unknown,
): value is ReportCategorySummary {
  return (
    isRecord(value) &&
    (typeof value.categoryId === "string" || value.categoryId === null) &&
    typeof value.name === "string" &&
    isReportMoneySummary(value)
  );
}

export function isReportsResponse(value: unknown): value is ReportsResponse {
  return (
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.fromMonth === "string" &&
    typeof value.toMonth === "string" &&
    isReportMoneySummary(value.totals) &&
    Array.isArray(value.monthly) &&
    value.monthly.every(isReportMonthSummary) &&
    Array.isArray(value.categories) &&
    value.categories.every(isReportCategorySummary)
  );
}

export function isBalanceViewSummary(
  value: unknown,
): value is BalanceViewSummary {
  return (
    isRecord(value) &&
    typeof value.accountId === "string" &&
    isMoneyDto(value.ledger) &&
    isMoneyDto(value.cleared) &&
    isMoneyDto(value.reconciled)
  );
}

export function isBalanceViewsResponse(
  value: unknown,
): value is BalanceViewSummary[] {
  return Array.isArray(value) && value.every(isBalanceViewSummary);
}
