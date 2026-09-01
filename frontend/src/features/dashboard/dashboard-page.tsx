"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon, type IconName } from "../../components/ui/icons";
import {
  type AccountSummary,
  type ApiError,
  type BalanceViewSummary,
  type BootstrapResponse,
  type BudgetSummary,
  type OverviewResponse,
  type TransactionSummary,
  type WorkspaceSummary,
} from "../../lib/api/contracts";
import { createHttpFinwiseApi, type FinwiseApi } from "../../lib/api/client";
import { formatMoney, formatShortDate } from "../../lib/formatting/money";
import { GroupTreasuryPage } from "../group/group-treasury-page";
import { IngestionPage } from "../ingestion/ingestion-page";
import { BudgetPage } from "../budget/budget-page";
import { LedgerActionPanel } from "../ledger/ledger-action-panel";
import { voidTransaction } from "../ledger/ledger-service";
import { SignOutButton } from "../../lib/auth/sign-out-button";

type DashboardSection =
  | "overview"
  | "accounts"
  | "transactions"
  | "budgets"
  | "reports"
  | "group"
  | "ingestion";

type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "empty" }
  | { status: "error"; error: ApiError }
  | { status: "forbidden"; error: ApiError };

type ExportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; error: ApiError };

type NavItem = {
  id: DashboardSection;
  label: string;
  icon: IconName;
};

const navItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "accounts", label: "Accounts", icon: "wallet" },
  { id: "transactions", label: "Transactions", icon: "receipt" },
  { id: "budgets", label: "Budgets", icon: "chart" },
];

const api: FinwiseApi = createHttpFinwiseApi();

function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FW";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function displayNameFor(bootstrap: BootstrapResponse | null): string {
  if (!bootstrap?.user.displayName) return "there";
  return bootstrap.user.displayName.split(" ")[0] ?? bootstrap.user.displayName;
}

function isForbidden(error: ApiError): boolean {
  return (
    error.code === "PERMISSION_DENIED" || error.code === "MEMBERSHIP_REQUIRED"
  );
}

function friendlyApiError(error: ApiError): {
  title: string;
  description: string;
  action?: string;
} {
  switch (error.code) {
    case "API_NOT_CONFIGURED":
      return {
        title: "Your workspace is ready when you are",
        description:
          "Connect the Finwise API to load accounts, balances, and transactions.",
      };
    case "AUTH_REQUIRED":
    case "SESSION_EXPIRED":
      return {
        title: "Sign in to view this workspace",
        description:
          "Your session is not available. Sign in again, then retry this view.",
        action: "Retry connection",
      };
    case "MEMBERSHIP_REQUIRED":
      return {
        title: "Workspace access required",
        description:
          "You are signed in, but do not have access to this workspace.",
        action: "Retry access",
      };
    case "PERMISSION_DENIED":
      return {
        title: "You do not have permission to view this data",
        description:
          "Ask a workspace owner for access to the relevant accounts or reports.",
      };
    default:
      return {
        title: "We could not load your workspace",
        description: error.message,
        action: "Retry",
      };
  }
}

export default function DashboardPage() {
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [bootstrapState, setBootstrapState] = useState<
    LoadState<BootstrapResponse>
  >({ status: "loading" });
  const [overviewState, setOverviewState] = useState<
    LoadState<OverviewResponse>
  >({ status: "loading" });
  const [balanceViewsState, setBalanceViewsState] = useState<
    LoadState<BalanceViewSummary[]>
  >({ status: "loading" });
  const [exportState, setExportState] = useState<ExportState>({
    status: "idle",
  });

  const loadOverview = useCallback(async (workspaceId: string) => {
    setOverviewState({ status: "loading" });
    setBalanceViewsState({ status: "loading" });
    const [result, balanceResult] = await Promise.all([
      api.getOverview(workspaceId),
      api.getBalanceViews(workspaceId),
    ]);
    if (balanceResult.ok) {
      setBalanceViewsState({ status: "ready", value: balanceResult.value });
    } else {
      setBalanceViewsState({
        status: isForbidden(balanceResult.error) ? "forbidden" : "error",
        error: balanceResult.error,
      });
    }
    if (result.ok) {
      setOverviewState(
        result.value.accounts.length === 0 &&
          result.value.recentTransactions.length === 0
          ? { status: "empty" }
          : { status: "ready", value: result.value },
      );
      return;
    }
    setOverviewState({
      status: isForbidden(result.error) ? "forbidden" : "error",
      error: result.error,
    });
  }, []);

  const loadWorkspace = useCallback(async () => {
    setBootstrapState({ status: "loading" });
    const result = await api.getBootstrap();
    if (!result.ok) {
      setBootstrapState({
        status: isForbidden(result.error) ? "forbidden" : "error",
        error: result.error,
      });
      setOverviewState({ status: "empty" });
      setBalanceViewsState({ status: "empty" });
      return;
    }

    setBootstrapState(
      result.value.workspaces.length === 0
        ? { status: "empty" }
        : { status: "ready", value: result.value },
    );
    if (result.value.suggestedWorkspaceId) {
      await loadOverview(result.value.suggestedWorkspaceId);
    } else {
      setOverviewState({ status: "empty" });
      setBalanceViewsState({ status: "empty" });
    }
  }, [loadOverview]);

  useEffect(() => {
    // The client boundary owns the initial workspace request and its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace();
  }, [loadWorkspace]);

  const bootstrap =
    bootstrapState.status === "ready" ? bootstrapState.value : null;
  const overview =
    overviewState.status === "ready" ? overviewState.value : null;
  const selectedWorkspace = bootstrap?.workspaces.find(
    (workspace) => workspace.id === bootstrap.suggestedWorkspaceId,
  );
  const hasWorkspaceError =
    bootstrapState.status === "error" || bootstrapState.status === "forbidden";

  const handleWorkspaceSelect = (workspace: WorkspaceSummary) => {
    setWorkspaceMenuOpen(false);
    if (bootstrapState.status === "ready") {
      setBootstrapState({
        status: "ready",
        value: { ...bootstrapState.value, suggestedWorkspaceId: workspace.id },
      });
    }
    void loadOverview(workspace.id);
  };

  const handleSectionChange = (section: DashboardSection) => {
    setActiveSection(section);
    setMobileNavOpen(false);
  };

  const retry = () => {
    void loadWorkspace();
  };

  const exportTransactions = useCallback(async () => {
    if (!selectedWorkspace) return;
    setExportState({ status: "loading" });
    const result = await api.exportTransactions(selectedWorkspace.id);
    if (!result.ok) {
      setExportState({ status: "error", error: result.error });
      return;
    }

    const downloadUrl = URL.createObjectURL(
      new Blob([result.value], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "finwise-transactions.csv";
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setExportState({ status: "success" });
  }, [selectedWorkspace]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div
        className={`mobile-nav-backdrop${mobileNavOpen ? " is-visible" : ""}`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside
        className={`sidebar${mobileNavOpen ? " is-open" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            F
          </div>
          <span className="brand-name">finwise</span>
          <span className="brand-beta">BETA</span>
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          >
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        <div className="workspace-switcher">
          <span className="eyebrow">WORKSPACE</span>
          <button
            className="workspace-button"
            type="button"
            aria-expanded={workspaceMenuOpen}
            aria-haspopup="listbox"
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <span className="workspace-avatar">
              {selectedWorkspace?.name.slice(0, 1).toUpperCase() ?? "P"}
            </span>
            <span className="workspace-button-copy">
              <strong>{selectedWorkspace?.name ?? "Personal workspace"}</strong>
              <small>
                {selectedWorkspace?.intent === "SHARED"
                  ? "Shared workspace"
                  : "Personal"}
              </small>
            </span>
            <Icon name="chevron-down" width={16} height={16} />
          </button>
          {workspaceMenuOpen && bootstrap?.workspaces.length ? (
            <div
              className="workspace-menu"
              role="listbox"
              aria-label="Select workspace"
            >
              {bootstrap.workspaces.map((workspace) => (
                <button
                  className={`workspace-option${workspace.id === selectedWorkspace?.id ? " is-selected" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={workspace.id === selectedWorkspace?.id}
                  key={workspace.id}
                  onClick={() => handleWorkspaceSelect(workspace)}
                >
                  <span className="workspace-avatar small">
                    {workspace.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{workspace.name}</strong>
                    <small>
                      {workspace.intent === "SHARED" ? "Shared" : "Personal"}
                    </small>
                  </span>
                  {workspace.id === selectedWorkspace?.id ? (
                    <span className="option-check">✓</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="nav-group" aria-label="Finwise sections">
          <span className="eyebrow nav-label">MONEY</span>
          {navItems.map((item) => (
            <button
              className={`nav-item${activeSection === item.id ? " is-active" : ""}`}
              type="button"
              aria-current={activeSection === item.id ? "page" : undefined}
              key={item.id}
              onClick={() => handleSectionChange(item.id)}
            >
              <Icon name={item.icon} width={18} height={18} />
              <span>{item.label}</span>
              {item.id === "transactions" &&
              overview &&
              overview.recentTransactions.length > 0 ? (
                <span className="nav-count">
                  {overview.recentTransactions.length}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <nav
          className="nav-group nav-group-secondary"
          aria-label="Workspace tools"
        >
          <span className="eyebrow nav-label">TOOLS</span>
          <button
            className={`nav-item${activeSection === "reports" ? " is-active" : ""}`}
            type="button"
            aria-current={activeSection === "reports" ? "page" : undefined}
            onClick={() => handleSectionChange("reports")}
          >
            <Icon name="chart" width={18} height={18} />
            <span>Reports</span>
            <span className="nav-soon">Soon</span>
          </button>
          <button
            className={`nav-item${activeSection === "group" ? " is-active" : ""}`}
            type="button"
            aria-current={activeSection === "group" ? "page" : undefined}
            onClick={() => handleSectionChange("group")}
          >
            <Icon name="users" width={18} height={18} />
            <span>Group Treasury</span>
          </button>
          <button
            className={`nav-item${activeSection === "ingestion" ? " is-active" : ""}`}
            type="button"
            aria-current={activeSection === "ingestion" ? "page" : undefined}
            onClick={() => handleSectionChange("ingestion")}
          >
            <Icon name="upload" width={18} height={18} />
            <span>Imports & reconciliation</span>
          </button>
          <button className="nav-item" type="button" onClick={() => undefined}>
            <Icon name="settings" width={18} height={18} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="privacy-note">
            <Icon name="shield" width={16} height={16} />
            <span>
              Your data stays private
              <br />
              <strong>Workspace-scoped by design</strong>
            </span>
          </div>
          <div className="user-card">
            <div className="user-avatar">
              {getInitials(bootstrap?.user.displayName ?? "Finwise")}
            </div>
            <div className="user-copy">
              <strong>{bootstrap?.user.displayName ?? "Your account"}</strong>
              <span>{bootstrap ? "Workspace owner" : "Not signed in"}</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu-button"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Icon name="menu" width={20} height={20} />
          </button>
          <div className="breadcrumbs">
            <span className="breadcrumb-muted">Workspace</span>
            <Icon name="chevron-right" width={14} height={14} />
            <strong>{selectedWorkspace?.name ?? "Personal workspace"}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-field">
              <Icon name="search" width={17} height={17} />
              <span className="visually-hidden">Search workspace</span>
              <input
                aria-label="Search workspace"
                placeholder="Search anything"
                type="search"
              />
            </label>
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="Notifications"
            >
              <Icon name="bell" width={19} height={19} />
              <span className="notification-dot" />
            </button>
          </div>
        </header>

        <main className="main-content" id="main-content">
          {activeSection === "overview" ? (
            <OverviewSection
              bootstrap={bootstrap}
              overview={overview}
              bootstrapState={bootstrapState}
              overviewState={overviewState}
              balanceViewsState={balanceViewsState}
              hasWorkspaceError={hasWorkspaceError}
              onRetry={retry}
              onSectionChange={handleSectionChange}
            />
          ) : (
            <ResourceSection
              section={activeSection}
              workspaceId={selectedWorkspace?.id ?? null}
              overview={overview}
              bootstrapState={bootstrapState}
              overviewState={overviewState}
              exportState={exportState}
              onRetry={retry}
              onExport={exportTransactions}
              onSectionChange={handleSectionChange}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>Finwise · VND workspace</span>
          <span>
            Last synced <strong>{overview ? "just now" : "—"}</strong>
          </span>
        </footer>
      </div>
    </div>
  );
}

type OverviewSectionProps = {
  bootstrap: BootstrapResponse | null;
  overview: OverviewResponse | null;
  bootstrapState: LoadState<BootstrapResponse>;
  overviewState: LoadState<OverviewResponse>;
  balanceViewsState: LoadState<BalanceViewSummary[]>;
  hasWorkspaceError: boolean;
  onRetry: () => void;
  onSectionChange: (section: DashboardSection) => void;
};

function OverviewSection({
  bootstrap,
  overview,
  bootstrapState,
  overviewState,
  balanceViewsState,
  hasWorkspaceError,
  onRetry,
  onSectionChange,
}: OverviewSectionProps) {
  const showConnectionPanel =
    hasWorkspaceError ||
    overviewState.status === "error" ||
    overviewState.status === "forbidden";
  const noData =
    overviewState.status === "empty" ||
    (!overview && !showConnectionPanel && bootstrapState.status !== "loading");

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="section-kicker">
            {overview?.period ?? "MONTHLY OVERVIEW"}
          </span>
          <h1>
            Good morning, {displayNameFor(bootstrap)}{" "}
            <span className="heading-wave">✦</span>
          </h1>
          <p>Here&apos;s how your money is moving this month.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" onClick={onRetry}>
            <Icon name="refresh" width={16} height={16} />
            Refresh
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => onSectionChange("transactions")}
          >
            <Icon name="plus" width={17} height={17} />
            Add transaction
          </button>
        </div>
      </section>

      {showConnectionPanel ? (
        <ConnectionPanel
          state={
            bootstrapState.status === "error" ||
            bootstrapState.status === "forbidden"
              ? bootstrapState
              : overviewState
          }
          onRetry={onRetry}
        />
      ) : null}
      {bootstrapState.status === "loading" ||
      overviewState.status === "loading" ? (
        <LoadingOverview />
      ) : null}
      {noData && !showConnectionPanel ? (
        <WorkspaceEmptyState onSectionChange={onSectionChange} />
      ) : null}
      {overview ? (
        <OverviewData
          overview={overview}
          balanceViews={
            balanceViewsState.status === "ready" ? balanceViewsState.value : []
          }
          onSectionChange={onSectionChange}
        />
      ) : null}
    </>
  );
}

function LoadingOverview() {
  return (
    <div
      className="loading-layout"
      aria-live="polite"
      aria-label="Loading workspace data"
    >
      <div className="skeleton skeleton-heading" />
      <div className="stats-grid">
        {[1, 2, 3, 4].map((item) => (
          <div className="skeleton skeleton-card" key={item} />
        ))}
      </div>
      <div className="content-grid">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  );
}

function ConnectionPanel({
  state,
  onRetry,
}: {
  state: LoadState<unknown>;
  onRetry: () => void;
}) {
  const error =
    state.status === "error" || state.status === "forbidden"
      ? state.error
      : undefined;
  const copy = error
    ? friendlyApiError(error)
    : { title: "Workspace unavailable", description: "Try again in a moment." };
  return (
    <section
      className={`connection-panel${state.status === "forbidden" ? " is-forbidden" : ""}`}
      role={state.status === "forbidden" ? "alert" : "status"}
    >
      <span className="connection-icon">
        <Icon
          name={state.status === "forbidden" ? "lock" : "shield"}
          width={19}
          height={19}
        />
      </span>
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
      </div>
      {copy.action ? (
        <button className="text-button" type="button" onClick={onRetry}>
          {copy.action}
          <Icon name="arrow-up-right" width={14} height={14} />
        </button>
      ) : null}
    </section>
  );
}

function WorkspaceEmptyState({
  onSectionChange,
}: {
  onSectionChange: (section: DashboardSection) => void;
}) {
  return (
    <section className="empty-hero">
      <div className="empty-orbit" aria-hidden="true">
        <span className="empty-orbit-dot one" />
        <span className="empty-orbit-dot two" />
        <span className="empty-orbit-dot three" />
        <div className="empty-wallet">
          <Icon name="wallet" width={28} height={28} />
        </div>
      </div>
      <div className="empty-hero-copy">
        <span className="section-kicker">YOUR MONEY, YOUR VIEW</span>
        <h2>Start with your first account</h2>
        <p>
          Add a cash or bank account to see your real balance, monthly movement,
          and budget progress in one calm view.
        </p>
        <div className="empty-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => onSectionChange("accounts")}
          >
            <Icon name="plus" width={17} height={17} />
            Add an account
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => onSectionChange("transactions")}
          >
            Record a transaction{" "}
            <Icon name="arrow-up-right" width={15} height={15} />
          </button>
        </div>
      </div>
    </section>
  );
}

function OverviewData({
  overview,
  balanceViews,
  onSectionChange,
}: {
  overview: OverviewResponse;
  balanceViews: BalanceViewSummary[];
  onSectionChange: (section: DashboardSection) => void;
}) {
  return (
    <>
      {overview.hasPartialAccess ? (
        <div className="partial-access-note" role="status">
          <Icon name="shield" width={16} height={16} />
          <span>
            Some account data is hidden based on your workspace permissions.
          </span>
        </div>
      ) : null}
      <section className="stats-grid" aria-label="Monthly summary">
        <MoneyStat
          label="Total balance"
          amount={overview.totals.accountBalance}
          helper="Across visible accounts"
          icon="wallet"
          accent="teal"
        />
        <MoneyStat
          label="Budget remaining"
          amount={overview.totals.budgetRemaining}
          helper="Plan, not cash balance"
          icon="chart"
          accent="lavender"
        />
        <MoneyStat
          label="Income this month"
          amount={overview.totals.income}
          helper="Confirmed inflows"
          icon="arrow-up-right"
          accent="yellow"
        />
        <MoneyStat
          label="Spent this month"
          amount={overview.totals.spending}
          helper="Eligible expenses"
          icon="arrow-down-right"
          accent="coral"
        />
      </section>
      <div className="content-grid">
        <SpendingPanel
          budgets={overview.budgets}
          onSetupBudget={() => onSectionChange("budgets")}
        />
        <RecentTransactions
          transactions={overview.recentTransactions}
          onViewAll={() => onSectionChange("transactions")}
        />
      </div>
      <section className="account-strip">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">VISIBLE ACCOUNTS</span>
            <h2>Where your money lives</h2>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => onSectionChange("accounts")}
          >
            View accounts <Icon name="arrow-up-right" width={14} height={14} />
          </button>
        </div>
        <div className="account-row">
          {overview.accounts.slice(0, 3).map((account) => (
            <AccountCard
              account={account}
              balanceView={balanceViews.find(
                (balance) => balance.accountId === account.id,
              )}
              key={account.id}
            />
          ))}
          {overview.accounts.length > 3 ? (
            <button
              className="more-accounts"
              type="button"
              onClick={() => onSectionChange("accounts")}
            >
              <span>+{overview.accounts.length - 3}</span>
              <small>View all</small>
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}

function MoneyStat({
  label,
  amount,
  helper,
  icon,
  accent,
}: {
  label: string;
  amount: import("../../lib/api/contracts").MoneyDto;
  helper: string;
  icon: IconName;
  accent: string;
}) {
  return (
    <article className={`stat-card accent-${accent}`}>
      <div className="stat-card-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon name={icon} width={17} height={17} />
        </span>
      </div>
      <strong className="stat-amount">{formatMoney(amount)}</strong>
      <span className="stat-helper">{helper}</span>
    </article>
  );
}

function SpendingPanel({
  budgets,
  onSetupBudget,
}: {
  budgets: BudgetSummary[];
  onSetupBudget: () => void;
}) {
  return (
    <section className="panel spending-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">BUDGET PULSE</span>
          <h2>This month&apos;s plan</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Budget options"
        >
          <Icon name="more" width={18} height={18} />
        </button>
      </div>
      {budgets.length === 0 ? (
        <div className="panel-empty">
          <div className="empty-mini-icon">
            <Icon name="chart" width={19} height={19} />
          </div>
          <strong>No budget plan yet</strong>
          <p>
            Create a monthly category plan to compare what you intended to spend
            with what actually moved.
          </p>
          <button className="text-button" type="button" onClick={onSetupBudget}>
            Set up a budget{" "}
            <Icon name="arrow-up-right" width={14} height={14} />
          </button>
        </div>
      ) : (
        <div className="budget-list">
          {budgets.slice(0, 4).map((budget) => (
            <BudgetRow budget={budget} key={budget.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function BudgetRow({ budget }: { budget: BudgetSummary }) {
  const available = parseMinorUnits(budget.available.minorUnits);
  const actual = parseMinorUnits(budget.actual.minorUnits);
  const progress =
    available > BigInt(0)
      ? Math.min(100, Math.max(0, Number((actual * BigInt(100)) / available)))
      : 0;
  return (
    <div className="budget-row">
      <div className="budget-row-copy">
        <strong>{budget.categoryName}</strong>
        <span>
          {formatMoney(budget.actual)} of {formatMoney(budget.available)}
        </span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <strong
        className={
          budget.remaining.minorUnits.startsWith("-") ? "is-negative" : ""
        }
      >
        {formatMoney(budget.remaining)}
      </strong>
    </div>
  );
}

function parseMinorUnits(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function RecentTransactions({
  transactions,
  onViewAll,
}: {
  transactions: TransactionSummary[];
  onViewAll: () => void;
}) {
  return (
    <section className="panel transactions-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">ACTIVITY</span>
          <h2>Recent transactions</h2>
        </div>
        <button className="text-button" type="button" onClick={onViewAll}>
          View all <Icon name="arrow-up-right" width={14} height={14} />
        </button>
      </div>
      {transactions.length === 0 ? (
        <div className="panel-empty">
          <div className="empty-mini-icon">
            <Icon name="receipt" width={19} height={19} />
          </div>
          <strong>Your activity will show up here</strong>
          <p>
            Once you record or confirm a transaction, you&apos;ll see the latest
            movement here.
          </p>
          <button className="text-button" type="button" onClick={onViewAll}>
            Record your first transaction{" "}
            <Icon name="plus" width={14} height={14} />
          </button>
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.slice(0, 5).map((transaction) => (
            <TransactionRow transaction={transaction} key={transaction.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function TransactionRow({
  transaction,
  workspaceId,
  onSuccess,
}: {
  transaction: TransactionSummary;
  workspaceId?: string | null;
  onSuccess?: () => void;
}) {
  const isIncome = transaction.type === "INCOME";
  const isTransfer = transaction.type === "TRANSFER";
  return (
    <div
      className={`transaction-row${transaction.status === "voided" ? " is-voided" : ""}`}
    >
      <span
        className={`transaction-icon ${isIncome ? "is-income" : isTransfer ? "is-transfer" : "is-expense"}`}
      >
        <Icon
          name={
            isIncome
              ? "arrow-up-right"
              : isTransfer
                ? "transfer"
                : "arrow-down-right"
          }
          width={16}
          height={16}
        />
      </span>
      <span className="transaction-copy">
        <strong>{transaction.description}</strong>
        <small>
          {transaction.categoryName ?? "Uncategorized"} ·{" "}
          {transaction.accountName}
        </small>
      </span>
      <span className="transaction-date">
        {formatShortDate(transaction.date)}
      </span>
      <strong
        className={`transaction-amount ${isIncome ? "is-income" : isTransfer ? "is-transfer" : ""}`}
      >
        {isIncome ? "+" : isTransfer ? "↔ " : "− "}
        {formatMoney(transaction.amount)}
      </strong>
      {workspaceId && onSuccess ? (
        <VoidTransactionControl
          workspaceId={workspaceId}
          transaction={transaction}
          onSuccess={onSuccess}
        />
      ) : null}
    </div>
  );
}

function VoidTransactionControl({
  workspaceId,
  transaction,
  onSuccess,
}: {
  workspaceId: string;
  transaction: TransactionSummary;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<
    | { status: "idle" | "saving" }
    | { status: "success" }
    | { status: "error"; error: ApiError }
  >({ status: "idle" });

  if (transaction.status === "voided") {
    return <span className="transaction-status">Voided</span>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "saving" });
    const result = await voidTransaction(workspaceId, transaction.id, {
      reason,
      effectiveDate: today(),
    });
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return;
    }
    setState({ status: "success" });
    setOpen(false);
    setReason("");
    onSuccess();
  }

  return (
    <div className="transaction-correction">
      {state.status === "error" ? (
        <span className="inline-feedback is-error" role="alert">
          {state.error.message}
        </span>
      ) : null}
      {open ? (
        <form className="transaction-correction-form" onSubmit={submit}>
          <label>
            Void reason
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              required
              autoFocus
            />
          </label>
          <div className="transaction-correction-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => setOpen(false)}
              disabled={state.status === "saving"}
            >
              Cancel
            </button>
            <button
              className="primary-button compact"
              type="submit"
              disabled={state.status === "saving"}
              aria-busy={state.status === "saving"}
            >
              {state.status === "saving" ? "Voiding…" : "Confirm void"}
            </button>
          </div>
        </form>
      ) : (
        <button
          className="text-button"
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Void ${transaction.description}`}
        >
          Void
        </button>
      )}
    </div>
  );
}

function AccountCard({
  account,
  balanceView,
}: {
  account: AccountSummary;
  balanceView?: BalanceViewSummary;
}) {
  const icon =
    account.type === "CASH"
      ? "wallet"
      : account.type === "BANK"
        ? "grid"
        : "chart";
  const label =
    account.type === "CASH"
      ? "Cash"
      : account.type === "BANK"
        ? "Bank"
        : account.type === "SAVINGS"
          ? "Savings"
          : "Account";
  return (
    <article className="account-card">
      <div className="account-card-top">
        <span className="account-icon">
          <Icon name={icon} width={17} height={17} />
        </span>
        <span className="account-type">{label}</span>
        <button
          className="icon-button"
          type="button"
          aria-label={`More options for ${account.name}`}
        >
          <Icon name="more" width={16} height={16} />
        </button>
      </div>
      <strong>{account.name}</strong>
      <span className="account-balance">{formatMoney(account.balance)}</span>
      {balanceView ? (
        <span className="account-balance-meta">
          Ledger {formatMoney(balanceView.ledger)} · Cleared{" "}
          {formatMoney(balanceView.cleared)} · Reconciled{" "}
          {formatMoney(balanceView.reconciled)}
        </span>
      ) : null}
    </article>
  );
}

type ResourceSectionProps = {
  section: Exclude<DashboardSection, "overview">;
  workspaceId: string | null;
  overview: OverviewResponse | null;
  bootstrapState: LoadState<BootstrapResponse>;
  overviewState: LoadState<OverviewResponse>;
  exportState: ExportState;
  onRetry: () => void;
  onExport: () => void;
  onSectionChange: (section: DashboardSection) => void;
};

function ResourceSection({
  section,
  workspaceId,
  overview,
  bootstrapState,
  overviewState,
  exportState,
  onRetry,
  onExport,
  onSectionChange,
}: ResourceSectionProps) {
  const titles: Record<
    Exclude<DashboardSection, "overview">,
    { kicker: string; title: string; description: string }
  > = {
    accounts: {
      kicker: "MONEY",
      title: "Accounts",
      description:
        "Keep every visible place your money lives in one workspace.",
    },
    transactions: {
      kicker: "MONEY",
      title: "Transactions",
      description:
        "Record and review confirmed movement without losing the audit trail.",
    },
    budgets: {
      kicker: "PLANNING",
      title: "Budgets",
      description:
        "Plan monthly spending without confusing a budget with cash.",
    },
    reports: {
      kicker: "INSIGHTS",
      title: "Reports",
      description:
        "Permission-filtered reports will live here as your workspace grows.",
    },
    group: {
      kicker: "SHARED MONEY",
      title: "Group Treasury",
      description:
        "Keep collections, treasury spending, and member support distinct.",
    },
    ingestion: {
      kicker: "INBOX & CONTROL",
      title: "Imports & reconciliation",
      description:
        "Review CSV evidence before it changes the immutable ledger.",
    },
  };
  if (section === "group") {
    return (
      <GroupTreasuryPage
        workspaceId={workspaceId}
        accounts={overview?.accounts ?? []}
        onRetry={onRetry}
      />
    );
  }
  if (section === "ingestion") {
    return (
      <IngestionPage
        workspaceId={workspaceId}
        accounts={overview?.accounts ?? []}
      />
    );
  }
  if (section === "budgets") {
    return <BudgetPage workspaceId={workspaceId} />;
  }
  const copy = titles[section];
  const items =
    section === "accounts"
      ? (overview?.accounts ?? [])
      : section === "transactions"
        ? (overview?.recentTransactions ?? [])
        : [];
  const shouldShowError =
    bootstrapState.status === "error" ||
    bootstrapState.status === "forbidden" ||
    overviewState.status === "error" ||
    overviewState.status === "forbidden";
  const canRenderLedgerActions =
    (section === "accounts" || section === "transactions") &&
    overviewState.status === "empty" &&
    workspaceId !== null;

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="section-kicker">{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" onClick={onRetry}>
            <Icon name="refresh" width={16} height={16} />
            Refresh
          </button>
          {section === "accounts" || section === "transactions" ? (
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                onSectionChange(
                  section === "accounts" ? "accounts" : "transactions",
                )
              }
            >
              <Icon name="plus" width={17} height={17} />
              {section === "accounts" ? "Add account" : "Add transaction"}
            </button>
          ) : null}
        </div>
      </section>
      {shouldShowError ? (
        <ConnectionPanel
          state={
            bootstrapState.status === "error" ||
            bootstrapState.status === "forbidden"
              ? bootstrapState
              : overviewState
          }
          onRetry={onRetry}
        />
      ) : null}
      {overviewState.status === "loading" ||
      bootstrapState.status === "loading" ? (
        <LoadingOverview />
      ) : null}
      {!shouldShowError &&
      !overview &&
      overviewState.status !== "loading" &&
      !canRenderLedgerActions ? (
        <ResourceEmpty section={section} onSectionChange={onSectionChange} />
      ) : null}
      {(overview || canRenderLedgerActions) && !shouldShowError ? (
        <ResourceContent
          section={section}
          workspaceId={workspaceId}
          accounts={overview?.accounts ?? []}
          items={items}
          exportState={exportState}
          onRefresh={onRetry}
          onExport={onExport}
          onSectionChange={onSectionChange}
        />
      ) : null}
    </>
  );
}

function ResourceEmpty({
  section,
  onSectionChange,
}: {
  section: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
}) {
  const isReports = section === "reports";
  return (
    <section className="resource-empty">
      <div className="empty-mini-icon large">
        <Icon
          name={
            isReports
              ? "chart"
              : section === "accounts"
                ? "wallet"
                : section === "budgets"
                  ? "calendar"
                  : "receipt"
          }
          width={23}
          height={23}
        />
      </div>
      <h2>
        {isReports ? "Reports are waiting for data" : `No ${section} yet`}
      </h2>
      <p>
        {isReports
          ? "Once your workspace has confirmed activity, permission-filtered insights will appear here."
          : `Add your first ${section === "accounts" ? "account" : section === "transactions" ? "transaction" : "budget"} to get started.`}
      </p>
      {!isReports && section !== "budgets" ? (
        <button
          className="primary-button"
          type="button"
          onClick={() => onSectionChange(section)}
        >
          <Icon name="plus" width={17} height={17} />
          {section === "accounts" ? "Add an account" : "Record a transaction"}
        </button>
      ) : null}
    </section>
  );
}

function ResourceContent({
  section,
  workspaceId,
  accounts,
  items,
  exportState,
  onRefresh,
  onExport,
  onSectionChange,
}: {
  section: DashboardSection;
  workspaceId: string | null;
  accounts: AccountSummary[];
  items: AccountSummary[] | TransactionSummary[] | BudgetSummary[];
  exportState: ExportState;
  onRefresh: () => void;
  onExport: () => void;
  onSectionChange: (section: DashboardSection) => void;
}) {
  if (section === "accounts")
    return (
      <>
        <LedgerActionPanel
          mode="account"
          workspaceId={workspaceId}
          accounts={accounts}
          onSuccess={onRefresh}
        />
        <LedgerActionPanel
          mode="opening"
          workspaceId={workspaceId}
          accounts={accounts}
          onSuccess={onRefresh}
        />
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>
              {items.length} visible account{items.length === 1 ? "" : "s"}
            </span>
            <span className="resource-hint">
              <Icon name="shield" width={15} height={15} />
              Balances are workspace-scoped
            </span>
          </div>
          <div className="resource-account-grid">
            {(items as AccountSummary[]).map((account) => (
              <AccountCard account={account} key={account.id} />
            ))}
          </div>
        </section>
      </>
    );
  if (section === "transactions")
    return (
      <>
        <LedgerActionPanel
          mode="transaction"
          workspaceId={workspaceId}
          accounts={accounts}
          onSuccess={onRefresh}
        />
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>
              {items.length} recent transaction{items.length === 1 ? "" : "s"}
            </span>
            <button
              className="text-button"
              type="button"
              onClick={onExport}
              disabled={exportState.status === "loading"}
              aria-busy={exportState.status === "loading"}
            >
              {exportState.status === "loading" ? "Preparing…" : "Export"}{" "}
              <Icon name="upload" width={14} height={14} />
            </button>
          </div>
          {exportState.status === "error" ? (
            <p className="inline-feedback is-error" role="alert">
              Export failed. {friendlyApiError(exportState.error).description}
            </p>
          ) : exportState.status === "success" ? (
            <p className="inline-feedback" role="status">
              CSV export downloaded with the same account visibility rules.
            </p>
          ) : null}
          <div className="transaction-list resource-list">
            {(items as TransactionSummary[]).map((transaction) => (
              <TransactionRow
                transaction={transaction}
                workspaceId={workspaceId}
                onSuccess={onRefresh}
                key={transaction.id}
              />
            ))}
          </div>
        </section>
      </>
    );
  if (section === "budgets")
    return (
      <section className="resource-panel">
        <div className="resource-toolbar">
          <span>
            {items.length} category allocation{items.length === 1 ? "" : "s"}
          </span>
          <span className="resource-hint">
            Soft budget · does not move cash
          </span>
        </div>
        <div className="budget-list resource-list">
          {(items as BudgetSummary[]).map((budget) => (
            <BudgetRow budget={budget} key={budget.id} />
          ))}
        </div>
      </section>
    );
  return <ResourceEmpty section={section} onSectionChange={onSectionChange} />;
}
