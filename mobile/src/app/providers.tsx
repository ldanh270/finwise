import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { BootstrapResponse, WorkspaceSummary } from "@finwise/api-client";
import { AuthProvider, useAuth } from "../auth/auth-context";
import { AppLockProvider, useAppLock } from "../auth/app-lock-context";
import { BootstrapCache } from "../cache/bootstrap-cache";
import { sqliteJsonStorage } from "../sync/sqlite-storage";
import {
  getWorkspaceBootstrapStatus,
  resolveWorkspaceId,
  type WorkspaceBootstrapStatus,
} from "./workspace-bootstrap";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

type WorkspaceContextValue = {
  readonly bootstrap: BootstrapResponse | undefined;
  readonly bootstrapIsStale: boolean;
  readonly bootstrapStatus: WorkspaceBootstrapStatus;
  readonly bootstrapError: unknown;
  readonly retryBootstrap: () => Promise<unknown>;
  readonly workspace: WorkspaceSummary | undefined;
  readonly workspaceId: string | undefined;
  readonly selectWorkspace: (workspaceId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLockProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AppLockProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function WorkspaceProvider({ children }: PropsWithChildren) {
  const { api, session, status } = useAuth();
  const { isLocked } = useAppLock();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [cachedBootstrap, setCachedBootstrap] = useState<BootstrapResponse>();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (status !== "signed_out") return;
    setSelectedWorkspaceId(undefined);
    setCachedBootstrap(undefined);
    queryClient.clear();
  }, [queryClient, status]);
  useEffect(() => {
    if (status !== "authenticated" || !session?.user.id) {
      setCachedBootstrap(undefined);
      return;
    }
    let active = true;
    setCachedBootstrap(undefined);
    void new BootstrapCache(session.user.id, sqliteJsonStorage)
      .read()
      .then((snapshot) => {
        if (active && snapshot) setCachedBootstrap(snapshot.value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session?.user.id, status]);
  const bootstrapQuery = useMemo(
    () => ({
      queryKey: ["bootstrap"],
      queryFn: () => api.getBootstrap(),
      enabled: status === "authenticated" && !isLocked,
    }),
    [api, isLocked, status],
  );
  const {
    data: bootstrap,
    error: bootstrapError,
    isError: hasBootstrapError,
    refetch: retryBootstrap,
  } = useQuery(bootstrapQuery);
  const effectiveBootstrap =
    status === "authenticated" ? (bootstrap ?? cachedBootstrap) : undefined;
  const bootstrapIsStale = !bootstrap && Boolean(cachedBootstrap);
  useEffect(() => {
    if (!session?.user.id || !bootstrap) return;
    void new BootstrapCache(session.user.id, sqliteJsonStorage).write(
      bootstrap,
    );
  }, [bootstrap, session?.user.id]);
  const bootstrapStatus = getWorkspaceBootstrapStatus(
    effectiveBootstrap,
    hasBootstrapError && !cachedBootstrap,
  );
  const workspaceId = resolveWorkspaceId(
    effectiveBootstrap,
    selectedWorkspaceId,
  );
  const workspace = effectiveBootstrap?.workspaces.find(
    (candidate) => candidate.id === workspaceId,
  );
  const value = useMemo(
    () => ({
      bootstrap: effectiveBootstrap,
      bootstrapIsStale,
      bootstrapError,
      bootstrapStatus,
      retryBootstrap: async () => retryBootstrap(),
      workspace,
      workspaceId,
      selectWorkspace: (nextWorkspaceId: string) =>
        setSelectedWorkspaceId(nextWorkspaceId),
    }),
    [
      bootstrapIsStale,
      effectiveBootstrap,
      bootstrapError,
      bootstrapStatus,
      retryBootstrap,
      workspace,
      workspaceId,
    ],
  );
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside AppProviders");
  return value;
}
