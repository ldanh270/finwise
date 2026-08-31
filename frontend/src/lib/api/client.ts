import {
  type ApiError,
  type ApiResult,
  type BalanceViewSummary,
  type BootstrapResponse,
  type GroupCollectionProgress,
  type GroupCollectionSummary,
  type GroupDirectExpense,
  type GroupReportSummary,
  type CategorySummary,
  type TagSummary,
  type BudgetPeriodSummary,
  type BudgetOverviewSummary,
  type ImportedRecordSummary,
  type ImportSessionSummary,
  type ReconciliationSummary,
  type OverviewResponse,
  isBootstrapResponse,
  isBalanceViewsResponse,
  isOverviewResponse,
  isGroupCollectionProgress,
  isGroupCollectionSummary,
  isGroupDirectExpense,
  isGroupReportSummary,
  isCategorySummary,
  isTagSummary,
  isBudgetPeriodSummary,
  isBudgetOverviewSummary,
  isImportedRecordSummary,
  isImportSessionSummary,
  isReconciliationSummary,
  isRecord,
} from "./contracts";
import { getAccessToken } from "../auth/session";

export type AccessTokenProvider = () => Promise<string | undefined>;

export type FinwiseApi = {
  getBootstrap(): Promise<ApiResult<BootstrapResponse>>;
  getOverview(workspaceId: string): Promise<ApiResult<OverviewResponse>>;
  getCategories(workspaceId: string): Promise<ApiResult<CategorySummary[]>>;
  createCategory(
    workspaceId: string,
    input: { name: string; parentId?: string },
  ): Promise<ApiResult<CategorySummary>>;
  getTags(workspaceId: string): Promise<ApiResult<TagSummary[]>>;
  createTag(
    workspaceId: string,
    input: { name: string },
  ): Promise<ApiResult<TagSummary>>;
  getBudgetPeriods(
    workspaceId: string,
  ): Promise<ApiResult<BudgetPeriodSummary[]>>;
  getBudgetOverview(
    workspaceId: string,
    month: string,
  ): Promise<ApiResult<BudgetOverviewSummary>>;
  createBudgetPeriod(
    workspaceId: string,
    input: {
      month: string;
      baseMinorUnits: string;
      constraints: readonly {
        categoryId: string;
        mode: "BY_CHILDREN" | "SHARED_POOL" | "HYBRID";
        fixedMinorUnits: string;
        percentageBasisPoints?: number;
        rolloverMode?: "NONE" | "POSITIVE_ONLY" | "FULL_BALANCE";
      }[];
    },
  ): Promise<ApiResult<BudgetPeriodSummary>>;
  closeBudgetPeriod(
    workspaceId: string,
    month: string,
  ): Promise<ApiResult<BudgetPeriodSummary>>;
  getBalanceViews(
    workspaceId: string,
  ): Promise<ApiResult<BalanceViewSummary[]>>;
  exportTransactions(workspaceId: string): Promise<ApiResult<string>>;
  getGroupCollections(
    workspaceId: string,
  ): Promise<ApiResult<GroupCollectionSummary[]>>;
  getGroupCollectionProgress(
    workspaceId: string,
    collectionId: string,
  ): Promise<ApiResult<GroupCollectionProgress>>;
  getGroupReportSummary(
    workspaceId: string,
  ): Promise<ApiResult<GroupReportSummary>>;
  createDirectGroupExpense(
    workspaceId: string,
    input: {
      accountId: string;
      amountMinorUnits: string;
      description: string;
      effectiveDate: string;
    },
    idempotencyKey: string,
  ): Promise<ApiResult<GroupDirectExpense>>;
  createAccount(
    workspaceId: string,
    input: { name: string; kind: "cash" | "bank" | "savings" | "other" },
  ): Promise<ApiResult<Record<string, unknown>>>;
  postOpeningBalance(
    workspaceId: string,
    accountId: string,
    input: {
      amountMinorUnits: string;
      effectiveDate: string;
      description?: string;
    },
    idempotencyKey: string,
  ): Promise<ApiResult<Record<string, unknown>>>;
  createTransaction(
    workspaceId: string,
    input: {
      type: "income" | "expense" | "transfer";
      amountMinorUnits: string;
      accountId: string;
      destinationAccountId?: string;
      effectiveDate: string;
      description?: string;
    },
    idempotencyKey: string,
  ): Promise<ApiResult<Record<string, unknown>>>;
  voidTransaction(
    workspaceId: string,
    transactionId: string,
    input: { reason: string; effectiveDate: string },
    idempotencyKey: string,
  ): Promise<ApiResult<Record<string, unknown>>>;
  getImportSessions(
    workspaceId: string,
  ): Promise<ApiResult<ImportSessionSummary[]>>;
  getImportedRecords(
    workspaceId: string,
    sessionId: string,
  ): Promise<ApiResult<ImportedRecordSummary[]>>;
  createImportSession(
    workspaceId: string,
    input: { accountId: string; fileName: string; csvContent: string },
  ): Promise<ApiResult<ImportSessionSummary & { duplicate: boolean }>>;
  confirmImportedRecord(
    workspaceId: string,
    recordId: string,
    idempotencyKey: string,
  ): Promise<ApiResult<ImportedRecordSummary>>;
  decideImportedRecord(
    workspaceId: string,
    recordId: string,
    status: "ignore" | "needs-attention",
    reason: string,
  ): Promise<ApiResult<ImportedRecordSummary>>;
  getReconciliations(
    workspaceId: string,
  ): Promise<ApiResult<ReconciliationSummary[]>>;
  startReconciliation(
    workspaceId: string,
    input: {
      accountId: string;
      statementDate: string;
      externalBalanceMinorUnits: string;
    },
  ): Promise<ApiResult<ReconciliationSummary>>;
};

type HttpFinwiseApiOptions = {
  baseUrl?: string;
  getAccessToken?: AccessTokenProvider;
};

const errorMessages: Record<string, ApiError["code"]> = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED",
  AUTH_CONFIGURATION: "AUTH_CONFIGURATION",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  MEMBERSHIP_REQUIRED: "MEMBERSHIP_REQUIRED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  VALIDATION_ERROR: "VALIDATION_FAILED",
  BUSINESS_STATE_INVALID: "CONFLICT",
  IDEMPOTENCY_KEY_REQUIRED: "VALIDATION_FAILED",
  IDEMPOTENCY_KEY_REUSED: "CONFLICT",
  RESOURCE_NOT_FOUND: "UNKNOWN_ERROR",
  CONFLICT: "CONFLICT",
};

function apiError(
  code: ApiError["code"],
  message: string,
  status?: number,
): ApiError {
  return { code, message, status };
}

function getResponseError(status: number, payload: unknown): ApiError {
  const payloadRecord = isRecord(payload) ? payload : undefined;
  const payloadCode = payloadRecord?.code;
  const code =
    typeof payloadCode === "string" && payloadCode in errorMessages
      ? errorMessages[payloadCode]
      : status === 401
        ? "AUTH_REQUIRED"
        : status === 403
          ? "PERMISSION_DENIED"
          : status === 409
            ? "CONFLICT"
            : "UNKNOWN_ERROR";

  const message =
    typeof payloadRecord?.message === "string"
      ? payloadRecord.message
      : "Finwise could not complete that request.";
  const requestId =
    typeof payloadRecord?.requestId === "string"
      ? payloadRecord.requestId
      : undefined;

  return { code, message, requestId, status };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function createHttpFinwiseApi(
  options: HttpFinwiseApiOptions = {},
): FinwiseApi {
  const configuredBaseUrl =
    options.baseUrl ?? process.env.NEXT_PUBLIC_FINWISE_API_URL;
  const baseUrl = configuredBaseUrl
    ? normalizeBaseUrl(configuredBaseUrl)
    : undefined;

  const getRuntimeAccessToken: AccessTokenProvider =
    options.getAccessToken ?? getAccessToken;

  async function getJson<T>(
    path: string,
    isResponse: (value: unknown) => value is T,
  ): Promise<ApiResult<T>> {
    if (!baseUrl) {
      return {
        ok: false,
        error: apiError(
          "API_NOT_CONFIGURED",
          "Connect the Finwise API to load workspace data.",
        ),
      };
    }

    try {
      const token = await getRuntimeAccessToken();
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        cache: "no-store",
      });
      const payload = await readJson(response);

      if (!response.ok) {
        return { ok: false, error: getResponseError(response.status, payload) };
      }
      if (!isResponse(payload)) {
        return {
          ok: false,
          error: apiError(
            "UNKNOWN_ERROR",
            "The Finwise API returned an invalid response.",
          ),
        };
      }
      return { ok: true, value: payload };
    } catch {
      return {
        ok: false,
        error: apiError(
          "NETWORK_ERROR",
          "Finwise is temporarily unavailable. Check your connection and retry.",
        ),
      };
    }
  }

  async function getText(path: string): Promise<ApiResult<string>> {
    if (!baseUrl) {
      return {
        ok: false,
        error: apiError(
          "API_NOT_CONFIGURED",
          "Connect the Finwise API to export workspace data.",
        ),
      };
    }

    try {
      const token = await getRuntimeAccessToken();
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          Accept: "text/csv",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        cache: "no-store",
      });
      const body = await response.text();
      if (!response.ok) {
        let payload: unknown;
        try {
          payload = JSON.parse(body) as unknown;
        } catch {
          payload = undefined;
        }
        return { ok: false, error: getResponseError(response.status, payload) };
      }
      return { ok: true, value: body };
    } catch {
      return {
        ok: false,
        error: apiError(
          "NETWORK_ERROR",
          "Finwise is temporarily unavailable. Check your connection and retry.",
        ),
      };
    }
  }

  async function postJson<T>(
    path: string,
    body: unknown,
    idempotencyKey: string | undefined,
    isResponse: (value: unknown) => value is T,
  ): Promise<ApiResult<T>> {
    if (!baseUrl) {
      return {
        ok: false,
        error: apiError(
          "API_NOT_CONFIGURED",
          "Connect the Finwise API to update workspace data.",
        ),
      };
    }
    try {
      const token = await getRuntimeAccessToken();
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        return { ok: false, error: getResponseError(response.status, payload) };
      }
      if (!isResponse(payload)) {
        return {
          ok: false,
          error: apiError(
            "UNKNOWN_ERROR",
            "The Finwise API returned an invalid response.",
          ),
        };
      }
      return { ok: true, value: payload };
    } catch {
      return {
        ok: false,
        error: apiError(
          "NETWORK_ERROR",
          "Finwise is temporarily unavailable. Check your connection and retry.",
        ),
      };
    }
  }

  return {
    getBootstrap: () => getJson("/v1/session/bootstrap", isBootstrapResponse),
    getOverview: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/overview`,
        isOverviewResponse,
      ),
    getCategories: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/categories`,
        (value): value is CategorySummary[] =>
          Array.isArray(value) && value.every(isCategorySummary),
      ),
    createCategory: (workspaceId, input) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/categories`,
        input,
        undefined,
        isCategorySummary,
      ),
    getTags: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/tags`,
        (value): value is TagSummary[] =>
          Array.isArray(value) && value.every(isTagSummary),
      ),
    createTag: (workspaceId, input) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/tags`,
        input,
        undefined,
        isTagSummary,
      ),
    getBudgetPeriods: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/budgets`,
        (value): value is BudgetPeriodSummary[] =>
          Array.isArray(value) && value.every(isBudgetPeriodSummary),
      ),
    getBudgetOverview: (workspaceId, month) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/budgets/${encodeURIComponent(month)}`,
        isBudgetOverviewSummary,
      ),
    createBudgetPeriod: (workspaceId, input) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/budgets`,
        input,
        undefined,
        isBudgetPeriodSummary,
      ),
    closeBudgetPeriod: (workspaceId, month) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/budgets/${encodeURIComponent(month)}/close`,
        undefined,
        undefined,
        isBudgetPeriodSummary,
      ),
    getBalanceViews: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/balances`,
        isBalanceViewsResponse,
      ),
    exportTransactions: (workspaceId) =>
      getText(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/transactions/export`,
      ),
    getGroupCollections: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/group/collections`,
        (value): value is GroupCollectionSummary[] =>
          Array.isArray(value) && value.every(isGroupCollectionSummary),
      ),
    getGroupCollectionProgress: (workspaceId, collectionId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/group/collections/${encodeURIComponent(collectionId)}/progress`,
        isGroupCollectionProgress,
      ),
    getGroupReportSummary: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/group/reports/summary`,
        isGroupReportSummary,
      ),
    createDirectGroupExpense: (workspaceId, input, idempotencyKey) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/group/expenses`,
        input,
        idempotencyKey,
        isGroupDirectExpense,
      ),
    createAccount: (workspaceId, input) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/accounts`,
        input,
        undefined,
        isRecord,
      ),
    postOpeningBalance: (workspaceId, accountId, input, idempotencyKey) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/accounts/${encodeURIComponent(accountId)}/opening-balance`,
        input,
        idempotencyKey,
        isRecord,
      ),
    createTransaction: (workspaceId, input, idempotencyKey) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/transactions`,
        input,
        idempotencyKey,
        isRecord,
      ),
    voidTransaction: (workspaceId, transactionId, input, idempotencyKey) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/transactions/${encodeURIComponent(transactionId)}/void`,
        input,
        idempotencyKey,
        isRecord,
      ),
    getImportSessions: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/imports`,
        (value): value is ImportSessionSummary[] =>
          Array.isArray(value) && value.every(isImportSessionSummary),
      ),
    getImportedRecords: (workspaceId, sessionId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/imports/${encodeURIComponent(sessionId)}/records`,
        (value): value is ImportedRecordSummary[] =>
          Array.isArray(value) && value.every(isImportedRecordSummary),
      ),
    createImportSession: (workspaceId, input) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/imports`,
        input,
        undefined,
        (value): value is ImportSessionSummary & { duplicate: boolean } =>
          isRecord(value) &&
          typeof value.duplicate === "boolean" &&
          isImportSessionSummary(value),
      ),
    confirmImportedRecord: (workspaceId, recordId, idempotencyKey) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/imports/records/${encodeURIComponent(recordId)}/confirm`,
        undefined,
        idempotencyKey,
        isImportedRecordSummary,
      ),
    decideImportedRecord: (workspaceId, recordId, status, reason) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/imports/records/${encodeURIComponent(recordId)}/${status}`,
        { reason },
        undefined,
        isImportedRecordSummary,
      ),
    getReconciliations: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/reconciliations`,
        (value): value is ReconciliationSummary[] =>
          Array.isArray(value) && value.every(isReconciliationSummary),
      ),
    startReconciliation: (workspaceId, input) =>
      postJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/reconciliations`,
        input,
        undefined,
        isReconciliationSummary,
      ),
  };
}
