import * as SecureStore from "expo-secure-store";
import type { AuthSessionResponse } from "@finwise/api-client";

export type StoredSession = Pick<
  AuthSessionResponse,
  "accessToken" | "accessTokenExpiresAt" | "refreshToken" | "user"
>;

export interface SessionStorage {
  read(): Promise<StoredSession | null>;
  write(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

const SESSION_KEY = "finwise.mobile.session.v1";

export class ExpoSecureSessionStorage implements SessionStorage {
  async read(): Promise<StoredSession | null> {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return parseStoredSession(raw);
  }

  async write(session: StoredSession): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }

  clear(): Promise<void> {
    return SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

export class MemorySessionStorage implements SessionStorage {
  private session: StoredSession | null = null;

  async read(): Promise<StoredSession | null> {
    return this.session;
  }

  async write(session: StoredSession): Promise<void> {
    this.session = session;
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}

function parseStoredSession(raw: string): StoredSession {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Stored Finwise session is invalid JSON");
  }
  if (
    !isRecord(value) ||
    typeof value.accessToken !== "string" ||
    typeof value.accessTokenExpiresAt !== "string" ||
    (value.refreshToken !== undefined &&
      typeof value.refreshToken !== "string") ||
    !isRecord(value.user) ||
    typeof value.user.id !== "string" ||
    typeof value.user.email !== "string" ||
    typeof value.user.displayName !== "string"
  ) {
    throw new Error("Stored Finwise session has an invalid shape");
  }
  return value as unknown as StoredSession;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
