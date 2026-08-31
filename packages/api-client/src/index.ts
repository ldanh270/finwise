/**
 * Stable client boundary for web and mobile.
 *
 * The OpenAPI document is the source contract; this first slice keeps the
 * transport deliberately small until the generator is wired into CI.
 */
export type MoneyDto = {
  readonly currency: "VND";
  readonly minorUnits: string;
};

export type ErrorEnvelope = {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
  readonly requestId?: string;
};

export type CursorPage<T> = {
  readonly items: readonly T[];
  readonly nextCursor?: string;
};

export type TransactionDto = {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind:
    "opening_balance" | "income" | "expense" | "transfer" | "adjustment";
  readonly status: "posted" | "voided";
  readonly amount: MoneyDto;
  readonly effectiveDate: string;
  readonly recordedAt: string;
};

export type BalanceViewDto = {
  readonly accountId: string;
  readonly ledger: MoneyDto;
  readonly cleared: MoneyDto;
  readonly reconciled: MoneyDto;
};

export type ManualTransactionInput = {
  readonly type: "income" | "expense";
  readonly accountId: string;
  readonly amount: MoneyDto;
  readonly effectiveDate: string;
  readonly description?: string;
};

export type FinwiseClientOptions = {
  readonly baseUrl: string;
  readonly getAccessToken?: () => Promise<string | undefined>;
  readonly fetchImpl?: typeof fetch;
};

export class FinwiseApiError extends Error {
  constructor(
    readonly status: number,
    readonly envelope: ErrorEnvelope,
  ) {
    super(envelope.message);
    this.name = "FinwiseApiError";
  }
}

export class FinwiseApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: FinwiseClientOptions["getAccessToken"];
  private readonly fetchImpl: typeof fetch;

  constructor(options: FinwiseClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(
    path: string,
    body: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    return this.request<T>("POST", path, body, idempotencyKey);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  async getText(path: string): Promise<string> {
    const response = await this.fetchResponse("GET", path, "text/csv");
    const payload = await response.text();
    if (!response.ok) {
      throw new FinwiseApiError(response.status, errorEnvelope(payload));
    }
    return payload;
  }

  async getBalanceViews(
    workspaceId: string,
  ): Promise<readonly BalanceViewDto[]> {
    return this.get<readonly BalanceViewDto[]>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/balances`,
    );
  }

  async postManualTransaction(
    workspaceId: string,
    input: ManualTransactionInput,
    idempotencyKey: string,
  ): Promise<TransactionDto> {
    return this.post<TransactionDto>(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/transactions`,
      input,
      idempotencyKey,
    );
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const response = await this.fetchResponse(
      method,
      path,
      "application/json",
      body,
      idempotencyKey,
    );
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new FinwiseApiError(
        response.status,
        isErrorEnvelope(payload)
          ? payload
          : { code: "UNKNOWN_ERROR", message: "Finwise request failed." },
      );
    }
    return payload as T;
  }

  private async fetchResponse(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    accept: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<Response> {
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: accept,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

function errorEnvelope(payload: string): ErrorEnvelope {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (isErrorEnvelope(parsed)) return parsed;
  } catch {
    // The response body is intentionally not exposed when it is not a typed error.
  }
  return { code: "UNKNOWN_ERROR", message: "Finwise request failed." };
}
