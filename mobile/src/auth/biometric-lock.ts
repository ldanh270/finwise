import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

export type BiometricCapability = {
  readonly hardwareAvailable: boolean;
  readonly enrolled: boolean;
  readonly available: boolean;
};

export interface BiometricPreferenceStorage {
  read(userId: string): Promise<boolean>;
  write(userId: string, enabled: boolean): Promise<void>;
}

const preferenceKeyPrefix = "finwise.mobile.biometric.v1";

export class ExpoBiometricPreferenceStorage implements BiometricPreferenceStorage {
  async read(userId: string): Promise<boolean> {
    const raw = await SecureStore.getItemAsync(preferenceKey(userId));
    if (!raw) return false;
    return parsePreference(raw, userId);
  }

  async write(userId: string, enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(
      preferenceKey(userId),
      JSON.stringify({ userId, enabled }),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
    );
  }
}

export class MemoryBiometricPreferenceStorage implements BiometricPreferenceStorage {
  private readonly enabledByUser = new Map<string, boolean>();

  read(userId: string): Promise<boolean> {
    return Promise.resolve(this.enabledByUser.get(userId) ?? false);
  }

  async write(userId: string, enabled: boolean): Promise<void> {
    this.enabledByUser.set(userId, enabled);
  }
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const hardwareAvailable = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hardwareAvailable
      ? await LocalAuthentication.isEnrolledAsync()
      : false;
    return {
      hardwareAvailable,
      enrolled,
      available: hardwareAvailable && enrolled,
    };
  } catch {
    return {
      hardwareAvailable: false,
      enrolled: false,
      available: false,
    };
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Finwise",
      fallbackLabel: "Use password",
      cancelLabel: "Not now",
    });
    return result.success;
  } catch {
    return false;
  }
}

export function preferenceKey(userId: string): string {
  return `${preferenceKeyPrefix}:${encodeURIComponent(userId)}`;
}

function parsePreference(raw: string, userId: string): boolean {
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) && value.userId === userId && value.enabled === true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
