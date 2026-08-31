"use client";

const API_URL = (process.env.NEXT_PUBLIC_FINWISE_API_URL ?? "").replace(
  /\/$/,
  "",
);

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly displayName?: string;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly user: AuthUser;
}

let accessToken: string | undefined;
let refreshInFlight: Promise<string | undefined> | undefined;

export function setAccessToken(token: string | undefined): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = undefined;
}

export async function getAccessToken(): Promise<string | undefined> {
  if (accessToken) return accessToken;
  if (!API_URL) return undefined;
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = undefined;
    });
  }
  return refreshInFlight;
}

export async function login(input: {
  readonly email: string;
  readonly password: string;
}): Promise<AuthSession> {
  return authenticate("login", input);
}

export async function register(input: {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
}): Promise<AuthSession> {
  return authenticate("register", input);
}

export async function logout(): Promise<void> {
  try {
    if (API_URL) {
      await fetch(`${API_URL}/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    }
  } finally {
    clearAccessToken();
  }
}

async function authenticate(
  action: "login" | "register",
  input: Record<string, string>,
): Promise<AuthSession> {
  if (!API_URL) throw new Error("Authentication is not configured.");
  const response = await fetch(`${API_URL}/v1/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const payload = await readJson(response);
  if (!response.ok || !isAuthSession(payload)) {
    throw new Error(errorMessage(payload, response.status));
  }
  accessToken = payload.accessToken;
  return payload;
}

async function refreshAccessToken(): Promise<string | undefined> {
  const response = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok || !isAuthSession(payload)) {
    clearAccessToken();
    return undefined;
  }
  accessToken = payload.accessToken;
  return accessToken;
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

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const user = candidate.user;
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.accessTokenExpiresAt === "string" &&
    !!user &&
    typeof user === "object" &&
    typeof (user as Record<string, unknown>).id === "string" &&
    typeof (user as Record<string, unknown>).email === "string"
  );
}

function errorMessage(value: unknown, status: number): string {
  if (value && typeof value === "object") {
    const message = (value as Record<string, unknown>).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return status === 429
    ? "Too many attempts. Try again later."
    : "We could not authenticate you. Check your details and try again.";
}
