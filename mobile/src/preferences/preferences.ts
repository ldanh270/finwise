import type { PrefixJsonStorage } from "../sync/outbox-persistence";

export type ThemePreference = "system" | "light" | "dark";
export type Locale = "en" | "vi";

export type MobilePreferences = {
  readonly theme: ThemePreference;
  readonly locale: Locale;
};

const DEFAULT_PREFERENCES: MobilePreferences = {
  theme: "system",
  locale: "en",
};

export class PreferencesStore {
  constructor(
    private readonly userId: string,
    private readonly storage: PrefixJsonStorage,
  ) {}

  async read(): Promise<MobilePreferences> {
    const raw = await this.storage.getItem(this.key());
    if (!raw) return DEFAULT_PREFERENCES;
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value !== "object" || value === null) {
        return DEFAULT_PREFERENCES;
      }
      const record = value as Record<string, unknown>;
      return {
        theme: isThemePreference(record.theme)
          ? record.theme
          : DEFAULT_PREFERENCES.theme,
        locale: isLocale(record.locale)
          ? record.locale
          : DEFAULT_PREFERENCES.locale,
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  write(value: MobilePreferences): Promise<void> {
    return this.storage.setItem(this.key(), JSON.stringify(value));
  }

  clear(): Promise<void> {
    return this.storage.removeItem(this.key());
  }

  private key(): string {
    return `finwise:preferences:${this.userId}`;
  }
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}
