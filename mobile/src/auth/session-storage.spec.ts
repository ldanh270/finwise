import * as SecureStore from "expo-secure-store";
import {
  ExpoSecureSessionStorage,
  MemorySessionStorage,
} from "./session-storage";

jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 42,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe("mobile session storage", () => {
  const session = {
    accessToken: "access",
    accessTokenExpiresAt: "2026-09-01T00:00:00.000Z",
    refreshToken: "refresh",
    user: { id: "user-1", email: "member@example.com", displayName: "Member" },
  } as const;

  it("keeps the in-memory test adapter replaceable", async () => {
    const storage = new MemorySessionStorage();
    await storage.write(session);
    await expect(storage.read()).resolves.toEqual(session);
    await storage.clear();
    await expect(storage.read()).resolves.toBeNull();
  });

  it("serializes sessions through SecureStore only", async () => {
    const getItemAsync = jest.mocked(SecureStore.getItemAsync);
    const setItemAsync = jest.mocked(SecureStore.setItemAsync);
    const deleteItemAsync = jest.mocked(SecureStore.deleteItemAsync);
    getItemAsync.mockResolvedValue(JSON.stringify(session));
    const storage = new ExpoSecureSessionStorage();
    await storage.write(session);
    await expect(storage.read()).resolves.toEqual(session);
    await storage.clear();
    expect(setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(session),
      expect.objectContaining({ keychainAccessible: 42 }),
    );
    expect(deleteItemAsync).toHaveBeenCalled();
  });
});
