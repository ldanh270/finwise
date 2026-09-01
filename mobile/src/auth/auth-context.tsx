import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  FinwiseApiClient,
  FinwiseApiError,
  type AuthSessionResponse,
} from "@finwise/api-client";
import {
  ExpoSecureSessionStorage,
  type SessionStorage,
  type StoredSession,
} from "./session-storage";
import { Platform } from "react-native";
import { resolveMobileApiUrl } from "../config/runtime-url";

type AuthStatus = "restoring" | "signed_out" | "authenticated";

export type AuthContextValue = {
  readonly status: AuthStatus;
  readonly session: StoredSession | null;
  readonly api: FinwiseApiClient;
  readonly error: string | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signUp: (
    displayName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  readonly refreshSession: () => Promise<boolean>;
  readonly signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{
  readonly storage?: SessionStorage;
  readonly apiBaseUrl?: string;
}>;

export function AuthProvider({
  children,
  storage,
  apiBaseUrl,
}: AuthProviderProps) {
  const sessionStorage = useMemo(
    () => storage ?? new ExpoSecureSessionStorage(),
    [storage],
  );
  const sessionRef = useRef<StoredSession | null>(null);
  const refreshHandlerRef = useRef<(() => Promise<boolean>) | null>(null);
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const baseUrl = resolveMobileApiUrl(
    apiBaseUrl ?? process.env.EXPO_PUBLIC_FINWISE_API_URL,
    Platform.OS,
  );

  const api = useMemo(
    () =>
      new FinwiseApiClient({
        baseUrl,
        clientType: "mobile",
        getAccessToken: async () => sessionRef.current?.accessToken,
        getRefreshToken: async () => sessionRef.current?.refreshToken,
        refreshAccessToken: async () => refreshHandlerRef.current?.() ?? false,
      }),
    [baseUrl],
  );

  const applySession = useCallback(
    async (next: AuthSessionResponse) => {
      if (!next.refreshToken)
        throw new Error("Mobile auth response did not include a refresh token");
      const stored: StoredSession = {
        accessToken: next.accessToken,
        accessTokenExpiresAt: next.accessTokenExpiresAt,
        refreshToken: next.refreshToken,
        user: next.user,
      };
      sessionRef.current = stored;
      setSession(stored);
      setStatus("authenticated");
      setError(null);
      await sessionStorage.write(stored);
    },
    [sessionStorage],
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const refreshPromise = (async () => {
      if (!sessionRef.current?.refreshToken) return false;
      try {
        await applySession(await api.refresh());
        return true;
      } catch (requestError: unknown) {
        if (
          requestError instanceof FinwiseApiError &&
          requestError.status === 401
        ) {
          sessionRef.current = null;
          setSession(null);
          setStatus("signed_out");
          await sessionStorage.clear();
        }
        return false;
      }
    })();
    refreshPromiseRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, [api, applySession, sessionStorage]);

  useEffect(() => {
    refreshHandlerRef.current = refreshSession;
    return () => {
      refreshHandlerRef.current = null;
    };
  }, [refreshSession]);

  useEffect(() => {
    let active = true;
    void sessionStorage
      .read()
      .then(async (stored) => {
        if (!active) return;
        if (!stored) {
          setStatus("signed_out");
          return;
        }
        sessionRef.current = stored;
        setSession(stored);
        const expiresAt = Date.parse(stored.accessTokenExpiresAt);
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now() + 30_000) {
          const refreshed = await refreshSession();
          if (!refreshed && active) setStatus("signed_out");
        } else {
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (active) setStatus("signed_out");
      });
    return () => {
      active = false;
    };
  }, [refreshSession, sessionStorage]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        await applySession(await api.login({ email, password }));
      } catch (requestError: unknown) {
        const message =
          requestError instanceof FinwiseApiError
            ? requestError.envelope.message
            : "Unable to sign in. Check your connection and credentials.";
        setError(message);
        throw new Error(message);
      }
    },
    [api, applySession],
  );

  const signUp = useCallback(
    async (displayName: string, email: string, password: string) => {
      try {
        await applySession(
          await api.register({ displayName, email, password }),
        );
      } catch (requestError: unknown) {
        const message =
          requestError instanceof FinwiseApiError
            ? requestError.envelope.message
            : "Unable to create your account.";
        setError(message);
        throw new Error(message);
      }
    },
    [api, applySession],
  );

  const signOut = useCallback(async () => {
    let logoutWarning: string | null = null;
    try {
      await api.logout();
    } catch (requestError: unknown) {
      // Local cleanup still guarantees user/workspace isolation when the
      // server is unreachable. Keep the warning generic and token-free.
      logoutWarning =
        requestError instanceof FinwiseApiError && requestError.status < 500
          ? null
          : "Signed out on this device; the server session will expire shortly.";
    }
    sessionRef.current = null;
    setSession(null);
    setStatus("signed_out");
    setError(logoutWarning);
    await sessionStorage.clear();
  }, [api, sessionStorage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      api,
      error,
      signIn,
      signUp,
      refreshSession,
      signOut,
    }),
    [api, error, refreshSession, session, signIn, signOut, signUp, status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
