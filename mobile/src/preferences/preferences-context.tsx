import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useColorScheme } from "react-native";
import { useAuth } from "../auth/auth-context";
import { sqliteJsonStorage } from "../sync/sqlite-storage";
import {
  PreferencesStore,
  type Locale,
  type MobilePreferences,
  type ThemePreference,
} from "./preferences";

type PreferenceContextValue = MobilePreferences & {
  readonly resolvedTheme: "light" | "dark";
  readonly setTheme: (theme: ThemePreference) => Promise<void>;
  readonly setLocale: (locale: Locale) => Promise<void>;
};

const PreferenceContext = createContext<PreferenceContextValue | null>(null);

export function PreferenceProvider({ children }: PropsWithChildren) {
  const { session, status } = useAuth();
  const systemTheme = useColorScheme();
  const [preferences, setPreferences] = useState<MobilePreferences>({
    theme: "system",
    locale: "en",
  });

  useEffect(() => {
    if (status !== "authenticated" || !session?.user.id) {
      setPreferences({ theme: "system", locale: "en" });
      return;
    }
    let active = true;
    void new PreferencesStore(session.user.id, sqliteJsonStorage)
      .read()
      .then((value) => {
        if (active) setPreferences(value);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id, status]);

  const value = useMemo<PreferenceContextValue>(
    () => ({
      ...preferences,
      resolvedTheme:
        preferences.theme === "system"
          ? systemTheme === "dark"
            ? "dark"
            : "light"
          : preferences.theme,
      setTheme: async (theme) => {
        const next = { ...preferences, theme };
        setPreferences(next);
        if (session?.user.id) {
          await new PreferencesStore(session.user.id, sqliteJsonStorage).write(
            next,
          );
        }
      },
      setLocale: async (locale) => {
        const next = { ...preferences, locale };
        setPreferences(next);
        if (session?.user.id) {
          await new PreferencesStore(session.user.id, sqliteJsonStorage).write(
            next,
          );
        }
      },
    }),
    [preferences, session?.user.id, systemTheme],
  );
  return (
    <PreferenceContext.Provider value={value}>
      {children}
    </PreferenceContext.Provider>
  );
}

export function usePreferences(): PreferenceContextValue {
  const value = useContext(PreferenceContext);
  if (!value)
    throw new Error("usePreferences must be used inside PreferenceProvider");
  return value;
}

export function useTranslation() {
  const { locale } = usePreferences();
  return (key: keyof typeof COPY): string => COPY[key][locale];
}

const COPY = {
  home: { en: "Home", vi: "Trang chủ" },
  accounts: { en: "Account", vi: "Tài khoản" },
  add: { en: "Add", vi: "Thêm" },
  reports: { en: "Report", vi: "Báo cáo" },
  other: { en: "Other", vi: "Khác" },
} as const;
