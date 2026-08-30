import {
  type ApiError,
  type ApiResult,
  type BootstrapResponse,
  type OverviewResponse,
  isBootstrapResponse,
  isOverviewResponse,
  isRecord,
} from "./contracts";

export type AccessTokenProvider = () => Promise<string | undefined>;

export type FinwiseApi = {
  getBootstrap(): Promise<ApiResult<BootstrapResponse>>;
  getOverview(workspaceId: string): Promise<ApiResult<OverviewResponse>>;
};

type HttpFinwiseApiOptions = {
  baseUrl?: string;
  getAccessToken?: AccessTokenProvider;
};

const errorMessages: Record<string, ApiError["code"]> = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
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
      const token = options.getAccessToken
        ? await options.getAccessToken()
        : undefined;
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

  return {
    getBootstrap: () => getJson("/v1/session/bootstrap", isBootstrapResponse),
    getOverview: (workspaceId) =>
      getJson(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/overview`,
        isOverviewResponse,
      ),
  };
}
