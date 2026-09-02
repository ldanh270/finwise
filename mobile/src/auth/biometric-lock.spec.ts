jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: async () => true,
  isEnrolledAsync: async () => true,
  authenticateAsync: async () => ({ success: true }),
}));

jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "after-first-unlock",
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

import {
  ExpoBiometricPreferenceStorage,
  MemoryBiometricPreferenceStorage,
  authenticateBiometric,
  getBiometricCapability,
  preferenceKey,
} from "./biometric-lock";

describe("biometric lock boundary", () => {
  it("partitions preferences by user", async () => {
    const storage = new MemoryBiometricPreferenceStorage();
    await storage.write("user-a", true);

    await expect(storage.read("user-a")).resolves.toBe(true);
    await expect(storage.read("user-b")).resolves.toBe(false);
    expect(preferenceKey("user-a")).not.toBe(preferenceKey("user-b"));
  });

  it("reports device capability and authenticates through the native adapter", async () => {
    await expect(getBiometricCapability()).resolves.toEqual({
      hardwareAvailable: true,
      enrolled: true,
      available: true,
    });
    await expect(authenticateBiometric()).resolves.toBe(true);
  });

  it("uses SecureStore without exposing preference contents to callers", async () => {
    const storage = new ExpoBiometricPreferenceStorage();
    await expect(storage.read("user-a")).resolves.toBe(false);
  });
});
