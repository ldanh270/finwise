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

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const token = this.getAccessToken ? await this.getAccessToken() : undefined;
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const envelope = isErrorEnvelope(payload)
        ? payload
        : { code: "UNKNOWN_ERROR", message: "Finwise request failed." };
      throw new FinwiseApiError(response.status, envelope);
    }
    return payload as T;
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
