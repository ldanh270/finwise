"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Icon } from "../../components/ui/icons";
import type {
  AccountSummary,
  ApiError,
  ImportedRecordSummary,
  ReconciliationSummary,
} from "../../lib/api/contracts";
import { formatMoney, formatShortDate } from "../../lib/formatting/money";
import {
  confirmImportedRecord,
  createImportSession,
  decideImportedRecord,
  loadIngestion,
  startReconciliation,
  type IngestionSnapshot,
} from "./ingestion-service";

type Props = {
  workspaceId: string | null;
  accounts: AccountSummary[];
};

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: IngestionSnapshot }
  | { status: "empty"; message: string }
  | { status: "error"; error: ApiError };

type ActionState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; error: ApiError };

export function IngestionPage({ workspaceId, accounts }: Props) {
  const [state, setState] = useState<PageState>({ status: "idle" });
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
  });
  const [reconciliationState, setReconciliationState] = useState<ActionState>({
    status: "idle",
  });
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [externalBalanceMinorUnits, setExternalBalanceMinorUnits] =
    useState("");
  const [statementDate, setStatementDate] = useState(today());
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (selectedSessionId?: string) => {
      if (!workspaceId) {
        setState({
          status: "empty",
          message: "Choose a workspace to review imports.",
        });
        return;
      }
      setState({ status: "loading" });
      const result = await loadIngestion(workspaceId, selectedSessionId);
      if (!result.ok) {
        setState({ status: "error", error: result.error });
        return;
      }
      setState({ status: "ready", value: result.value });
    },
    [workspaceId],
  );

  useEffect(() => {
    // This feature owns import/reconciliation read lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (accounts.some((account) => account.id === accountId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountId(accounts[0]?.id ?? "");
  }, [accountId, accounts]);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvContent(await file.text());
  }

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    setActionState({ status: "saving" });
    const result = await createImportSession(workspaceId, {
      accountId,
      fileName,
      csvContent,
    });
    if (!result.ok) {
      setActionState({ status: "error", error: result.error });
      return;
    }
    setActionState({ status: "success" });
    setCsvContent("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
    await load(result.value.id);
  }

  async function submitReconciliation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    setReconciliationState({ status: "saving" });
    const result = await startReconciliation(workspaceId, {
      accountId,
      statementDate,
      externalBalanceMinorUnits,
    });
    if (!result.ok) {
      setReconciliationState({ status: "error", error: result.error });
      return;
    }
    setReconciliationState({ status: "success" });
    setExternalBalanceMinorUnits("");
    await load();
  }

  if (state.status === "idle" || state.status === "loading")
    return <IngestionLoading />;
  if (state.status === "error") {
    return <IngestionError error={state.error} onRetry={() => void load()} />;
  }
  if (state.status === "empty")
    return (
      <section className="resource-empty">
        <div className="empty-mini-icon large">
          <Icon name="upload" width={23} height={23} />
        </div>
        <h2>No workspace selected</h2>
        <p>{state.message}</p>
      </section>
    );

  const { sessions, records, reconciliations, selectedSessionId } = state.value;
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="section-kicker">INBOX & CONTROL</span>
          <h1>Imports & reconciliation</h1>
          <p>Review CSV evidence before it changes the immutable ledger.</p>
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
      <div className="ingestion-grid">
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>CSV inbox</span>
            <span className="resource-hint">Raw rows stay private</span>
          </div>
          <form className="ingestion-form" onSubmit={submitImport}>
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
              CSV file
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void readFile(event)}
                required
              />
            </label>
            <p className="form-help">
              Required columns: date, amountMinorUnits, type. Optional:
              description, sourceKey.
            </p>
            {fileName ? (
              <p className="form-help">
                {fileName} · {csvContent.length.toLocaleString()} bytes staged
              </p>
            ) : null}
            {actionState.status === "error" ? (
              <p className="inline-feedback is-error" role="alert">
                {actionState.error.message}
              </p>
            ) : null}
            {actionState.status === "success" ? (
              <p className="inline-feedback" role="status">
                Import received. Review normalized rows below.
              </p>
            ) : null}
            <button
              className="primary-button"
              type="submit"
              disabled={
                actionState.status === "saving" ||
                !csvContent ||
                accounts.length === 0
              }
              aria-busy={actionState.status === "saving"}
            >
              {actionState.status === "saving" ? "Uploading…" : "Review CSV"}
            </button>
          </form>
          <div className="import-session-list" aria-label="Import sessions">
            {sessions.length === 0 ? (
              <p className="empty-copy">No import sessions yet.</p>
            ) : (
              sessions.map((session) => (
                <button
                  className={`import-session-row${session.id === selectedSessionId ? " is-selected" : ""}`}
                  type="button"
                  key={session.id}
                  onClick={() => void load(session.id)}
                >
                  <span>
                    <strong>{session.fileName}</strong>
                    <small>
                      {formatShortDate(session.createdAt)} · {session.status}
                    </small>
                  </span>
                  <span>
                    {session.rawDeletedAt
                      ? "Raw deleted"
                      : `${session.rawSizeBytes.toLocaleString()} B`}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>Reconciliation checkpoint</span>
            <span className="resource-hint">Explicit adjustment only</span>
          </div>
          <form className="ingestion-form" onSubmit={submitReconciliation}>
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
              Statement date
              <input
                type="date"
                value={statementDate}
                onChange={(event) => setStatementDate(event.target.value)}
                required
              />
            </label>
            <label>
              External balance (minor units)
              <input
                inputMode="numeric"
                pattern="[0-9]+"
                value={externalBalanceMinorUnits}
                onChange={(event) =>
                  setExternalBalanceMinorUnits(event.target.value)
                }
                required
              />
            </label>
            {reconciliationState.status === "error" ? (
              <p className="inline-feedback is-error" role="alert">
                {reconciliationState.error.message}
              </p>
            ) : null}
            {reconciliationState.status === "success" ? (
              <p className="inline-feedback" role="status">
                Checkpoint created and refreshed.
              </p>
            ) : null}
            <button
              className="primary-button"
              type="submit"
              disabled={
                reconciliationState.status === "saving" || accounts.length === 0
              }
              aria-busy={reconciliationState.status === "saving"}
            >
              {reconciliationState.status === "saving"
                ? "Checking…"
                : "Start checkpoint"}
            </button>
          </form>
          <div className="reconciliation-list">
            {reconciliations.length === 0 ? (
              <p className="empty-copy">No reconciliation checkpoints yet.</p>
            ) : (
              reconciliations
                .slice(0, 5)
                .map((checkpoint) => (
                  <ReconciliationRow
                    checkpoint={checkpoint}
                    key={checkpoint.id}
                  />
                ))
            )}
          </div>
        </section>
      </div>
      <section className="resource-panel import-record-panel">
        <div className="resource-toolbar">
          <span>Normalized records</span>
          <span className="resource-hint">
            Confirm posts once · match never posts
          </span>
        </div>
        {records.length === 0 ? (
          <p className="empty-copy">
            Select an import session to review its rows.
          </p>
        ) : (
          <div className="import-record-list">
            {records.map((record) => (
              <ImportRecordRow
                record={record}
                workspaceId={workspaceId}
                onDone={() => void load(selectedSessionId ?? undefined)}
                key={record.id}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ImportRecordRow({
  record,
  workspaceId,
  onDone,
}: {
  record: ImportedRecordSummary;
  workspaceId: string | null;
  onDone: () => void;
}) {
  const [state, setState] = useState<ActionState>({ status: "idle" });
  async function decide(action: "confirm" | "ignore") {
    if (!workspaceId) return;
    setState({ status: "saving" });
    const result =
      action === "confirm"
        ? await confirmImportedRecord(workspaceId, record.id)
        : await decideImportedRecord(workspaceId, record.id, "ignored");
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return;
    }
    setState({ status: "success" });
    onDone();
  }
  const terminal =
    record.status === "confirmed" ||
    record.status === "ignored" ||
    record.status === "needs_attention";
  return (
    <article className="import-record-row">
      <div>
        <strong>{record.description || "Untitled row"}</strong>
        <small>
          {formatShortDate(record.effectiveDate)} · {record.sourceKey}
        </small>
      </div>
      <span className="import-record-amount">{formatMoney(record.amount)}</span>
      <span className="import-record-status">{record.status}</span>
      {state.status === "error" ? (
        <span className="inline-feedback is-error" role="alert">
          {state.error.message}
        </span>
      ) : null}
      <div className="import-record-actions">
        <button
          className="text-button"
          type="button"
          disabled={terminal || state.status === "saving"}
          onClick={() => void decide("ignore")}
        >
          Ignore
        </button>
        <button
          className="primary-button compact"
          type="button"
          disabled={terminal || state.status === "saving"}
          onClick={() => void decide("confirm")}
        >
          Confirm
        </button>
      </div>
    </article>
  );
}

function ReconciliationRow({
  checkpoint,
}: {
  checkpoint: ReconciliationSummary;
}) {
  return (
    <article className="reconciliation-row">
      <div>
        <strong>{formatShortDate(checkpoint.statementDate)}</strong>
        <small>{checkpoint.status}</small>
      </div>
      <span>{formatMoney(checkpoint.difference)}</span>
    </article>
  );
}

function IngestionLoading() {
  return (
    <div
      className="loading-layout"
      aria-live="polite"
      aria-label="Loading import and reconciliation data"
    >
      <div className="skeleton skeleton-heading" />
      <div className="content-grid">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  );
}
function IngestionError({
  error,
  onRetry,
}: {
  error: ApiError;
  onRetry: () => void;
}) {
  return (
    <section className="connection-panel is-forbidden" role="alert">
      <span className="connection-icon">
        <Icon name="lock" width={19} height={19} />
      </span>
      <div>
        <strong>Inbox unavailable</strong>
        <p>{error.message}</p>
      </div>
      <button className="secondary-button" type="button" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
