import { PreferencesStore } from "./preferences";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => void values.set(key, value),
    removeItem: async (key: string) => void values.delete(key),
    removeByPrefix: async () => undefined,
  };
}

describe("PreferencesStore", () => {
  it("keeps theme and locale isolated per user", async () => {
    const sharedStorage = storage();
    const first = new PreferencesStore("user-1", sharedStorage);
    const second = new PreferencesStore("user-2", sharedStorage);

    await first.write({ theme: "dark", locale: "vi" });

    await expect(first.read()).resolves.toEqual({
      theme: "dark",
      locale: "vi",
    });
    await expect(second.read()).resolves.toEqual({
      theme: "system",
      locale: "en",
    });
  });
});
