"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/ui/icons";
import type { ApiError, ReportsResponse } from "../../lib/api/contracts";
import { formatMoney } from "../../lib/formatting/money";
import { loadReports } from "./reports-service";

type Props = { workspaceId: string | null };
type LoadState =
  | { status: "loading" }
  | { status: "ready"; value: ReportsResponse }
  | { status: "error"; error: ApiError };

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthOffset(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

export function ReportsPage({ workspaceId }: Props) {
  const end = currentMonth();
  const [fromMonth, setFromMonth] = useState(monthOffset(end, -5));
  const [toMonth, setToMonth] = useState(end);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!workspaceId) {
      setState({
        status: "error",
        error: {
          code: "MEMBERSHIP_REQUIRED",
          message: "Choose a workspace to view reports.",
        },
      });
      return;
    }
    setState({ status: "loading" });
    const result = await loadReports(workspaceId, { fromMonth, toMonth });
    setState(
      result.ok
        ? { status: "ready", value: result.value }
        : { status: "error", error: result.error },
    );
  }, [fromMonth, toMonth, workspaceId]);

  useEffect(() => {
    // The report feature owns its range and request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load();
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="section-kicker">INSIGHTS</span>
          <h1>Reports</h1>
          <p>Permission-filtered insights from your confirmed ledger.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => void load()}
        >
          <Icon name="refresh" width={16} height={16} />
          Refresh
        </button>
      </section>
      <form className="reports-filter" onSubmit={submit}>
        <label>
          From month
          <input
            type="month"
            value={fromMonth}
            onChange={(event) => setFromMonth(event.target.value)}
          />
        </label>
        <label>
          To month
          <input
            type="month"
            value={toMonth}
            onChange={(event) => setToMonth(event.target.value)}
          />
        </label>
        <button
          className="primary-button"
          type="submit"
          disabled={state.status === "loading"}
        >
          {state.status === "loading" ? "Loading…" : "Update report"}
        </button>
      </form>
      {state.status === "loading" ? <ReportsLoading /> : null}
      {state.status === "error" ? (
        <section className="connection-panel is-forbidden" role="alert">
          <span className="connection-icon">
            <Icon name="lock" width={19} height={19} />
          </span>
          <div>
            <strong>Reports are unavailable</strong>
            <p>{state.error.message}</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void load()}
          >
            Retry
          </button>
        </section>
      ) : null}
      {state.status === "ready" ? <ReportContent report={state.value} /> : null}
    </>
  );
}

function ReportContent({ report }: { report: ReportsResponse }) {
  return (
    <>
      {report.hasPartialAccess ? (
        <p className="partial-access-note">
          <Icon name="shield" width={15} height={15} /> Some account activity is
          excluded by your access scope.
        </p>
      ) : null}
      <section className="reports-total-grid">
        <ReportMetric label="Income" money={report.totals.income} />
        <ReportMetric label="Spending" money={report.totals.spending} />
        <ReportMetric label="Net movement" money={report.totals.net} />
      </section>
      <div className="reports-grid">
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>Monthly movement</span>
            <span className="resource-hint">
              {report.fromMonth} → {report.toMonth}
            </span>
          </div>
          {report.monthly.every(
            (row) =>
              row.income.minorUnits === "0" && row.spending.minorUnits === "0",
          ) ? (
            <p className="panel-empty">
              No confirmed income or spending in this range.
            </p>
          ) : (
            <div
              className="report-table"
              role="table"
              aria-label="Monthly movement"
            >
              <div className="report-table-row report-table-heading" role="row">
                <span>Month</span>
                <span>Income</span>
                <span>Spending</span>
                <span>Net</span>
              </div>
              {report.monthly.map((row) => (
                <div className="report-table-row" role="row" key={row.month}>
                  <strong>{row.month}</strong>
                  <span>{formatMoney(row.income)}</span>
                  <span>{formatMoney(row.spending)}</span>
                  <strong>{formatMoney(row.net)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>Spending by category</span>
            <span className="resource-hint">Classified lines</span>
          </div>
          {report.categories.length === 0 ? (
            <p className="panel-empty">
              Classify a transaction to see category movement.
            </p>
          ) : (
            <div className="report-category-list">
              {report.categories.map((category) => (
                <div
                  className="report-category-row"
                  key={category.categoryId ?? "uncategorized"}
                >
                  <span>
                    <strong>{category.name}</strong>
                    <small>Net {formatMoney(category.net)}</small>
                  </span>
                  <strong>{formatMoney(category.spending)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ReportMetric({
  label,
  money,
}: {
  label: string;
  money: ReportsResponse["totals"]["income"];
}) {
  return (
    <div className="reports-metric">
      <span>{label}</span>
      <strong>{formatMoney(money)}</strong>
    </div>
  );
}

function ReportsLoading() {
  return (
    <div className="reports-grid" aria-busy="true">
      <section className="resource-panel skeleton reports-skeleton" />
      <section className="resource-panel skeleton reports-skeleton" />
    </div>
  );
}
