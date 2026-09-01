"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/ui/icons";
import type {
  AccountSummary,
  ApiError,
  GroupCollectionProgress,
  GroupCollectionSummary,
  GroupReportSummary,
} from "../../lib/api/contracts";
import { formatMoney } from "../../lib/formatting/money";
import {
  loadGroupTreasury,
  postDirectGroupExpense,
  type GroupTreasurySnapshot,
} from "./group-service";

type Props = {
  workspaceId: string | null;
  accounts: AccountSummary[];
  onRetry: () => void;
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: GroupTreasurySnapshot }
  | { status: "empty"; message: string }
  | { status: "error"; error: ApiError };

type ExpenseState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; error: ApiError };

export function GroupTreasuryPage({ workspaceId, accounts, onRetry }: Props) {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [expenseState, setExpenseState] = useState<ExpenseState>({
    status: "idle",
  });
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amountMinorUnits, setAmountMinorUnits] = useState("");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());

  const load = useCallback(async () => {
    if (!workspaceId) {
      setState({
        status: "empty",
        message: "Choose a workspace to view treasury data.",
      });
      return;
    }
    setState({ status: "loading" });
    const result = await loadGroupTreasury(workspaceId);
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return;
    }
    setState({ status: "ready", value: result.value });
  }, [workspaceId]);

  useEffect(() => {
    // This feature owns its workspace-scoped read lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!accountId && accounts[0]) {
      // Keep the form usable when the workspace account list arrives asynchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    setExpenseState({ status: "saving" });
    const result = await postDirectGroupExpense(
      workspaceId,
      { accountId, amountMinorUnits, description, effectiveDate },
      `web-group-expense-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    if (!result.ok) {
      setExpenseState({ status: "error", error: result.error });
      return;
    }
    setExpenseState({ status: "success" });
    setAmountMinorUnits("");
    setDescription("");
    await load();
  }

  if (state.status === "loading" || state.status === "idle") {
    return <GroupLoading />;
  }
  if (state.status === "error") {
    return (
      <section className="connection-panel is-forbidden" role="alert">
        <span className="connection-icon">
          <Icon name="lock" width={19} height={19} />
        </span>
        <div>
          <strong>Group Treasury is unavailable</strong>
          <p>{state.error.message}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }
  if (state.status === "empty") {
    return (
      <section className="resource-empty">
        <div className="empty-mini-icon large">
          <Icon name="users" width={23} height={23} />
        </div>
        <h2>No Group Treasury workspace selected</h2>
        <p>{state.message}</p>
      </section>
    );
  }

  const { collections, progress, report } = state.value;
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="section-kicker">SHARED MONEY</span>
          <h1>Group Treasury</h1>
          <p>
            Keep collections, treasury spending, and member support distinct.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void load()}
          >
            <Icon name="refresh" width={16} height={16} />
            Refresh
          </button>
        </div>
      </section>

      <section
        className="stats-grid group-stats"
        aria-label="Group Treasury summary"
      >
        <SummaryCard
          label="Collected"
          value={formatMoney(report.collectionReceived)}
          detail={`of ${formatMoney(report.collectionExpected)} expected`}
        />
        <SummaryCard
          label="Outstanding"
          value={formatMoney(report.collectionOutstanding)}
          detail="collection obligations"
        />
        <SummaryCard
          label="Direct expenses"
          value={formatMoney(report.directExpense)}
          detail="posted from treasury"
        />
        <SummaryCard
          label="Open payables"
          value={formatMoney(report.openPayable)}
          detail={`${report.pendingSubmissionCount} pending submissions`}
        />
      </section>

      <div className="group-content-grid">
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>Collection progress</span>
            <span className="resource-hint">Verified payments only</span>
          </div>
          {collections.length === 0 ? (
            <p className="empty-copy">No collection campaigns yet.</p>
          ) : (
            <div className="group-collection-list">
              {collections.map((collection) => (
                <CollectionCard
                  collection={collection}
                  progress={progress[collection.id]}
                  key={collection.id}
                />
              ))}
            </div>
          )}
        </section>

        <section className="resource-panel group-expense-panel">
          <div className="resource-toolbar">
            <span>Post direct expense</span>
            <span className="resource-hint">Idempotent Ledger command</span>
          </div>
          <form className="group-expense-form" onSubmit={submitExpense}>
            <label>
              Account
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Select account
                </option>
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount (minor units)
              <input
                inputMode="numeric"
                pattern="[0-9]+"
                value={amountMinorUnits}
                onChange={(event) => setAmountMinorUnits(event.target.value)}
                required
              />
            </label>
            <label>
              Description
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                required
              />
            </label>
            <label>
              Effective date
              <input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                required
              />
            </label>
            {expenseState.status === "error" ? (
              <p className="inline-feedback is-error" role="alert">
                {expenseState.error.message}
              </p>
            ) : null}
            {expenseState.status === "success" ? (
              <p className="inline-feedback" role="status">
                Direct expense posted and summary refreshed.
              </p>
            ) : null}
            <button
              className="primary-button"
              type="submit"
              disabled={
                expenseState.status === "saving" || accounts.length === 0
              }
              aria-busy={expenseState.status === "saving"}
            >
              {expenseState.status === "saving" ? "Posting…" : "Post expense"}
            </button>
            {accounts.length === 0 ? (
              <p className="form-help">
                Add a visible workspace account before posting a group expense.
              </p>
            ) : null}
          </form>
        </section>
      </div>

      <section className="resource-panel group-report-panel">
        <div className="resource-toolbar">
          <span>Separate measures</span>
          <span className="resource-hint">
            Pending values never become cash automatically
          </span>
        </div>
        <div className="group-report-grid">
          <ReportMetric
            label="Approved claim expense"
            money={report.approvedClaimExpense}
          />
          <ReportMetric label="Sponsored value" money={report.sponsoredValue} />
          <ReportMetric
            label="Pending evidence"
            money={report.pendingSubmissionAmount}
          />
          <ReportMetric
            label="Pending submissions"
            text={String(report.pendingSubmissionCount)}
          />
        </div>
      </section>
    </>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span>{label}</span>
      </div>
      <strong className="stat-amount">{value}</strong>
      <small className="stat-helper">{detail}</small>
    </article>
  );
}

function CollectionCard({
  collection,
  progress,
}: {
  collection: GroupCollectionSummary;
  progress?: GroupCollectionProgress;
}) {
  const paid = progress ? parseMinorUnits(progress.paid.minorUnits) : BigInt(0);
  const total = progress
    ? parseMinorUnits(progress.total.minorUnits)
    : BigInt(0);
  const percentage =
    total > BigInt(0) ? Number((paid * BigInt(100)) / total) : 0;
  return (
    <article className="group-collection-card">
      <div className="group-collection-heading">
        <div>
          <strong>{collection.name}</strong>
          <span>{collection.status === "open" ? "Open" : "Closed"}</span>
        </div>
        <strong>{progress ? formatMoney(progress.paid) : "—"}</strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-label={`${collection.name} collection progress`}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
      <div className="group-collection-meta">
        <span>
          {progress
            ? `${progress.completedParticipants}/${progress.participantCount} participants paid`
            : "Loading progress…"}
        </span>
        <span>
          {progress ? `${formatMoney(progress.outstanding)} outstanding` : "—"}
        </span>
      </div>
    </article>
  );
}

function ReportMetric({
  label,
  money,
  text,
}: {
  label: string;
  money?: GroupReportSummary["directExpense"];
  text?: string;
}) {
  return (
    <div className="group-report-metric">
      <span>{label}</span>
      <strong>{text ?? formatMoney(money)}</strong>
    </div>
  );
}

function GroupLoading() {
  return (
    <div
      className="loading-layout"
      aria-live="polite"
      aria-label="Loading Group Treasury"
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseMinorUnits(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}
