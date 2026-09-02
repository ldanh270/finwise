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
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "./auth-context";
import {
  authenticateBiometric,
  ExpoBiometricPreferenceStorage,
  getBiometricCapability,
  type BiometricCapability,
  type BiometricPreferenceStorage,
} from "./biometric-lock";

export type AppLockStatus = "inactive" | "checking" | "locked" | "unlocked";

export type AppLockContextValue = {
  readonly status: AppLockStatus;
  readonly enabled: boolean;
  readonly isLocked: boolean;
  readonly capability: BiometricCapability;
  readonly error: string | null;
  readonly unlock: () => Promise<boolean>;
  readonly enable: () => Promise<boolean>;
  readonly disable: () => Promise<void>;
  readonly lock: () => void;
};

type AppLockProviderProps = PropsWithChildren<{
  readonly storage?: BiometricPreferenceStorage;
  readonly capabilityReader?: () => Promise<BiometricCapability>;
  readonly authenticator?: () => Promise<boolean>;
}>;

const unavailableCapability: BiometricCapability = {
  hardwareAvailable: false,
  enrolled: false,
  available: false,
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({
  children,
  storage,
  capabilityReader = getBiometricCapability,
  authenticator = authenticateBiometric,
}: AppLockProviderProps) {
  const { status: authStatus, session } = useAuth();
  const preferenceStorage = useMemo(
    () => storage ?? new ExpoBiometricPreferenceStorage(),
    [storage],
  );
  const [status, setStatus] = useState<AppLockStatus>("inactive");
  const [enabled, setEnabled] = useState(false);
  const [capability, setCapability] = useState<BiometricCapability>(
    unavailableCapability,
  );
  const [error, setError] = useState<string | null>(null);
  const unlockPromiseRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);
  const userIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runAuthentication = useCallback(async (): Promise<boolean> => {
    if (unlockPromiseRef.current) return unlockPromiseRef.current;
    const promise = authenticator();
    unlockPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      if (unlockPromiseRef.current === promise) {
        unlockPromiseRef.current = null;
      }
    }
  }, [authenticator]);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!enabled || !capability.available) {
      if (mountedRef.current) setStatus("unlocked");
      return true;
    }
    const success = await runAuthentication();
    if (!mountedRef.current) return success;
    if (success) {
      setStatus("unlocked");
      setError(null);
    } else {
      setStatus("locked");
      setError("Biometric verification was not completed.");
    }
    return success;
  }, [capability.available, enabled, runAuthentication]);

  useEffect(() => {
    userIdRef.current = session?.user.id;
    if (authStatus !== "authenticated" || !session?.user.id) {
      setStatus("inactive");
      setEnabled(false);
      setError(null);
      return;
    }

    let active = true;
    const userId = session.user.id;
    setStatus("checking");
    setError(null);
    void Promise.all([preferenceStorage.read(userId), capabilityReader()]).then(
      ([preferenceEnabled, nextCapability]) => {
        if (!active || !mountedRef.current || userIdRef.current !== userId)
          return;
        setCapability(nextCapability);
        setEnabled(preferenceEnabled);
        if (!preferenceEnabled || !nextCapability.available) {
          setStatus("unlocked");
          return;
        }
        setStatus("locked");
        void runAuthentication().then((success) => {
          if (!active || !mountedRef.current || userIdRef.current !== userId)
            return;
          if (success) {
            setStatus("unlocked");
          } else {
            setError("Biometric verification was not completed.");
          }
        });
      },
      () => {
        if (!active || !mountedRef.current || userIdRef.current !== userId)
          return;
        setEnabled(false);
        setStatus("unlocked");
        setError("Biometric lock settings could not be loaded.");
      },
    );
    return () => {
      active = false;
    };
  }, [
    authStatus,
    capabilityReader,
    preferenceStorage,
    runAuthentication,
    session?.user.id,
  ]);

  useEffect(() => {
    let previousState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = previousState === "active";
      previousState = nextState;
      if (authStatus !== "authenticated" || !enabled) return;
      if (wasActive && nextState !== "active") {
        setStatus("locked");
        return;
      }
      if (!wasActive && nextState === "active") void unlock();
    });
    return () => subscription.remove();
  }, [authStatus, enabled, unlock]);

  const enable = useCallback(async (): Promise<boolean> => {
    const userId = userIdRef.current;
    if (!userId || authStatus !== "authenticated") return false;
    const nextCapability = await capabilityReader();
    if (mountedRef.current) setCapability(nextCapability);
    if (!nextCapability.available) {
      if (mountedRef.current) {
        setError(
          "Set up Face ID, Touch ID, or a device biometric before enabling the app lock.",
        );
      }
      return false;
    }
    if (mountedRef.current) {
      setError(null);
      setStatus("locked");
    }
    const success = await runAuthentication();
    if (!success) {
      if (mountedRef.current) {
        setStatus("unlocked");
        setError("Biometric verification was not completed.");
      }
      return false;
    }
    await preferenceStorage.write(userId, true);
    if (mountedRef.current) {
      setEnabled(true);
      setStatus("unlocked");
      setError(null);
    }
    return true;
  }, [authStatus, capabilityReader, preferenceStorage, runAuthentication]);

  const disable = useCallback(async (): Promise<void> => {
    const userId = userIdRef.current;
    if (!userId) return;
    await preferenceStorage.write(userId, false);
    if (mountedRef.current) {
      setEnabled(false);
      setStatus("unlocked");
      setError(null);
    }
  }, [preferenceStorage]);

  const lock = useCallback(() => {
    if (enabled && mountedRef.current) setStatus("locked");
  }, [enabled]);

  const value = useMemo<AppLockContextValue>(
    () => ({
      status,
      enabled,
      isLocked: status === "checking" || status === "locked",
      capability,
      error,
      unlock,
      enable,
      disable,
      lock,
    }),
    [capability, disable, enable, enabled, error, lock, status, unlock],
  );
  return (
    <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  const value = useContext(AppLockContext);
  if (!value) throw new Error("useAppLock must be used inside AppLockProvider");
  return value;
}
