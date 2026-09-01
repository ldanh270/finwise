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
import {
  getWorkspaceBootstrapStatus,
  type WorkspaceBootstrapStatus,
} from "./workspace-bootstrap";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

type WorkspaceContextValue = {
  readonly bootstrap: BootstrapResponse | undefined;
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
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function WorkspaceProvider({ children }: PropsWithChildren) {
  const { api, status } = useAuth();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (status !== "signed_out") return;
    setSelectedWorkspaceId(undefined);
    queryClient.clear();
  }, [queryClient, status]);
  const bootstrapQuery = useMemo(
    () => ({
      queryKey: ["bootstrap"],
      queryFn: () => api.getBootstrap(),
      enabled: status === "authenticated",
    }),
    [api, status],
  );
  const {
    data: bootstrap,
    error: bootstrapError,
    isError: hasBootstrapError,
    refetch: retryBootstrap,
  } = useQuery(bootstrapQuery);
  const bootstrapStatus = getWorkspaceBootstrapStatus(
    bootstrap,
    hasBootstrapError,
  );
  const workspaceId =
    selectedWorkspaceId ??
    bootstrap?.suggestedWorkspaceId ??
    bootstrap?.workspaces[0]?.id;
  const workspace = bootstrap?.workspaces.find(
    (candidate) => candidate.id === workspaceId,
  );
  const value = useMemo(
    () => ({
      bootstrap,
      bootstrapError,
      bootstrapStatus,
      retryBootstrap: async () => retryBootstrap(),
      workspace,
      workspaceId,
      selectWorkspace: (nextWorkspaceId: string) =>
        setSelectedWorkspaceId(nextWorkspaceId),
    }),
    [
      bootstrap,
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
