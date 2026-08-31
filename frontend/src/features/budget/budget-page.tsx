"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/ui/icons";
import type {
  ApiError,
  BudgetOverviewSummary,
  CategorySummary,
} from "../../lib/api/contracts";
import { formatMoney } from "../../lib/formatting/money";
import {
  closeBudgetPeriod,
  createBudgetPeriod,
  createCategory,
  createTag,
  loadPlanning,
  type PlanningSnapshot,
} from "./budget-service";

type Props = { workspaceId: string | null };
type PageState =
  | { status: "loading" }
  | { status: "ready"; value: PlanningSnapshot }
  | { status: "empty"; message: string }
  | { status: "error"; error: ApiError };
type ActionState =
  | { status: "idle" | "saving" }
  | { status: "success" }
  | { status: "error"; error: ApiError };

export function BudgetPage({ workspaceId }: Props) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [categoryState, setCategoryState] = useState<ActionState>({
    status: "idle",
  });
  const [tagState, setTagState] = useState<ActionState>({ status: "idle" });
  const [budgetState, setBudgetState] = useState<ActionState>({
    status: "idle",
  });
  const [closeState, setCloseState] = useState<ActionState>({ status: "idle" });
  const [categoryName, setCategoryName] = useState("");
  const [parentId, setParentId] = useState("");
  const [tagName, setTagName] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [baseMinorUnits, setBaseMinorUnits] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [mode, setMode] = useState<"BY_CHILDREN" | "SHARED_POOL" | "HYBRID">(
    "SHARED_POOL",
  );
  const [fixedMinorUnits, setFixedMinorUnits] = useState("");
  const [percentageBasisPoints, setPercentageBasisPoints] = useState("0");
  const [rolloverMode, setRolloverMode] = useState<
    "NONE" | "POSITIVE_ONLY" | "FULL_BALANCE"
  >("NONE");

  const load = useCallback(
    async (selectedMonth?: string) => {
      if (!workspaceId) {
        setState({
          status: "empty",
          message: "Choose a workspace to manage budgets.",
        });
        return;
      }
      setState({ status: "loading" });
      const result = await loadPlanning(workspaceId, selectedMonth);
      if (!result.ok) {
        setState({ status: "error", error: result.error });
        return;
      }
      setState({ status: "ready", value: result.value });
      if (result.value.selectedMonth) setMonth(result.value.selectedMonth);
      if (!categoryId && result.value.categories[0])
        setCategoryId(result.value.categories[0].id);
    },
    [categoryId, workspaceId],
  );

  useEffect(() => {
    // Planning owns its read lifecycle and refreshes after every command.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    setCategoryState({ status: "saving" });
    const result = await createCategory(workspaceId, {
      name: categoryName,
      parentId: parentId || undefined,
    });
    if (!result.ok) {
      setCategoryState({ status: "error", error: result.error });
      return;
    }
    setCategoryState({ status: "success" });
    setCategoryName("");
    await load(
      state.status === "ready"
        ? (state.value.selectedMonth ?? undefined)
        : undefined,
    );
  }

  async function submitTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    setTagState({ status: "saving" });
    const result = await createTag(workspaceId, { name: tagName });
    if (!result.ok) {
      setTagState({ status: "error", error: result.error });
      return;
    }
    setTagState({ status: "success" });
    setTagName("");
    await load(
      state.status === "ready"
        ? (state.value.selectedMonth ?? undefined)
        : undefined,
    );
  }

  async function submitBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    setBudgetState({ status: "saving" });
    const result = await createBudgetPeriod(workspaceId, {
      month,
      baseMinorUnits,
      constraints: [
        {
          categoryId,
          mode,
          fixedMinorUnits: fixedMinorUnits || "0",
          percentageBasisPoints: Number(percentageBasisPoints),
          rolloverMode,
        },
      ],
    });
    if (!result.ok) {
      setBudgetState({ status: "error", error: result.error });
      return;
    }
    setBudgetState({ status: "success" });
    await load(month);
  }

  async function closeSelectedPeriod() {
    if (!workspaceId || !selectedOverview) return;
    setCloseState({ status: "saving" });
    const result = await closeBudgetPeriod(workspaceId, selectedOverview.month);
    if (!result.ok) {
      setCloseState({ status: "error", error: result.error });
      return;
    }
    setCloseState({ status: "success" });
    await load(selectedOverview.month);
  }

  if (state.status === "loading") return <BudgetLoading />;
  if (state.status === "error")
    return <BudgetError error={state.error} onRetry={() => void load()} />;
  if (state.status === "empty")
    return (
      <section className="resource-empty">
        <div className="empty-mini-icon large">
          <Icon name="calendar" width={23} height={23} />
        </div>
        <h2>No workspace selected</h2>
        <p>{state.message}</p>
      </section>
    );

  const snapshot = state.value;
  const selectedOverview = snapshot.overview;
  const roots = snapshot.categories.filter((category) => !category.parentId);
  return (
    <>
      <section className="page-heading">
        <div>
          <span className="section-kicker">PLANNING</span>
          <h1>Budgets</h1>
          <p>Plan monthly spending without confusing a budget with cash.</p>
        </div>
        <div className="heading-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void load(snapshot.selectedMonth ?? undefined)}
          >
            <Icon name="refresh" width={16} height={16} />
            Refresh
          </button>
        </div>
      </section>
      <div className="budget-planning-grid">
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>Category tree</span>
            <span className="resource-hint">Two levels maximum</span>
          </div>
          <form className="ingestion-form" onSubmit={submitCategory}>
            <label>
              Name
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                maxLength={100}
                required
              />
            </label>
            <label>
              Parent (optional)
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">Root category</option>
                {roots.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            {categoryState.status === "error" ? (
              <p className="inline-feedback is-error" role="alert">
                {categoryState.error.message}
              </p>
            ) : null}
            {categoryState.status === "success" ? (
              <p className="inline-feedback" role="status">
                Category created.
              </p>
            ) : null}
            <button
              className="primary-button"
              type="submit"
              disabled={categoryState.status === "saving"}
            >
              {categoryState.status === "saving" ? "Creating…" : "Add category"}
            </button>
          </form>
          <div className="category-list">
            {snapshot.categories.length === 0 ? (
              <p className="empty-copy">
                Create a category before allocating a budget.
              </p>
            ) : (
              snapshot.categories.map((category) => (
                <CategoryRow category={category} key={category.id} />
              ))
            )}
          </div>
        </section>
        <section className="resource-panel">
          <div className="resource-toolbar">
            <span>Tags</span>
            <span className="resource-hint">Classification labels</span>
          </div>
          <form className="ingestion-form" onSubmit={submitTag}>
            <label>
              Name
              <input
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
                maxLength={100}
                required
              />
            </label>
            {tagState.status === "error" ? (
              <p className="inline-feedback is-error" role="alert">
                {tagState.error.message}
              </p>
            ) : null}
            {tagState.status === "success" ? (
              <p className="inline-feedback" role="status">
                Tag created.
              </p>
            ) : null}
            <button
              className="primary-button"
              type="submit"
              disabled={tagState.status === "saving"}
            >
              {tagState.status === "saving" ? "Creating…" : "Add tag"}
            </button>
          </form>
          <div className="tag-list">
            {snapshot.tags.length === 0 ? (
              <p className="empty-copy">No tags yet.</p>
            ) : (
              snapshot.tags.map((tag) => (
                <span className="tag-chip" key={tag.id}>
                  {tag.name}
                </span>
              ))
            )}
          </div>
        </section>
      </div>
      <section className="resource-panel budget-editor-panel">
        <div className="resource-toolbar">
          <span>Monthly plan</span>
          <span className="resource-hint">
            Soft allocation · no cash movement
          </span>
        </div>
        <form className="budget-editor-form" onSubmit={submitBudget}>
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
            />
          </label>
          <label>
            Base (minor units)
            <input
              inputMode="numeric"
              pattern="[0-9]+"
              value={baseMinorUnits}
              onChange={(event) => setBaseMinorUnits(event.target.value)}
              required
            />
          </label>
          <label>
            Category
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
            >
              <option value="" disabled>
                Select category
              </option>
              {snapshot.categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="SHARED_POOL">Shared pool</option>
              <option value="BY_CHILDREN">By children</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </label>
          <label>
            Fixed (minor units)
            <input
              inputMode="numeric"
              pattern="[0-9]+"
              value={fixedMinorUnits}
              onChange={(event) => setFixedMinorUnits(event.target.value)}
            />
          </label>
          <label>
            Percentage (basis points)
            <input
              inputMode="numeric"
              pattern="[0-9]+"
              min="0"
              max="10000"
              value={percentageBasisPoints}
              onChange={(event) => setPercentageBasisPoints(event.target.value)}
            />
          </label>
          <label>
            Rollover
            <select
              value={rolloverMode}
              onChange={(event) =>
                setRolloverMode(event.target.value as typeof rolloverMode)
              }
            >
              <option value="NONE">None</option>
              <option value="POSITIVE_ONLY">Positive only</option>
              <option value="FULL_BALANCE">Full balance</option>
            </select>
          </label>
          {budgetState.status === "error" ? (
            <p className="inline-feedback is-error" role="alert">
              {budgetState.error.message}
            </p>
          ) : null}
          {budgetState.status === "success" ? (
            <p className="inline-feedback" role="status">
              Budget saved. Actuals remain ledger-derived.
            </p>
          ) : null}
          <button
            className="primary-button"
            type="submit"
            disabled={
              budgetState.status === "saving" ||
              snapshot.categories.length === 0
            }
          >
            {budgetState.status === "saving" ? "Saving…" : "Save monthly plan"}
          </button>
        </form>
      </section>
      <section className="resource-panel">
        <div className="resource-toolbar">
          <span>Budget periods</span>
          <span className="resource-hint">
            Select a month to inspect actuals
          </span>
        </div>
        <div className="budget-period-list">
          {snapshot.periods.length === 0 ? (
            <p className="empty-copy">No budget periods yet.</p>
          ) : (
            snapshot.periods.map((period) => (
              <button
                className={`budget-period-row${period.month === snapshot.selectedMonth ? " is-selected" : ""}`}
                type="button"
                key={period.id}
                onClick={() => void load(period.month)}
              >
                <strong>{period.month}</strong>
                <span>
                  {period.status} · base {formatMoney(period.base)}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
      {selectedOverview ? (
        <BudgetOverview
          overview={selectedOverview}
          categories={snapshot.categories}
          closeState={closeState}
          onClose={() => void closeSelectedPeriod()}
        />
      ) : null}
    </>
  );
}

function CategoryRow({ category }: { category: CategorySummary }) {
  return (
    <div className="category-row">
      <span>
        {category.parentId ? "↳ " : ""}
        {category.name}
      </span>
      <small>{category.status}</small>
    </div>
  );
}
function BudgetOverview({
  overview,
  categories,
  closeState,
  onClose,
}: {
  overview: BudgetOverviewSummary;
  categories: CategorySummary[];
  closeState: ActionState;
  onClose: () => void;
}) {
  const categoryName = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  return (
    <section className="resource-panel budget-overview-panel">
      <div className="resource-toolbar">
        <span>{overview.month} overview</span>
        <span className="resource-hint">{overview.status}</span>
      </div>
      <div className="budget-total-grid">
        <div>
          <span>Allocated</span>
          <strong>{formatMoney(overview.totals.allocated)}</strong>
        </div>
        <div>
          <span>Actual</span>
          <strong>{formatMoney(overview.totals.actual)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{formatMoney(overview.totals.remaining)}</strong>
        </div>
      </div>
      <div className="budget-constraint-list">
        {overview.constraints.map((constraint) => (
          <div className="budget-constraint-row" key={constraint.categoryId}>
            <span>
              <strong>
                {categoryName.get(constraint.categoryId) ?? "Category"}
              </strong>
              <small>
                {constraint.mode} · {constraint.rolloverMode}
              </small>
            </span>
            <span>
              {formatMoney(constraint.actual)} /{" "}
              {formatMoney(constraint.allocated)}
            </span>
            <strong>{formatMoney(constraint.remaining)}</strong>
          </div>
        ))}
      </div>
      {closeState.status === "error" ? (
        <p className="inline-feedback is-error" role="alert">
          {closeState.error.message}
        </p>
      ) : null}
      {closeState.status === "success" ? (
        <p className="inline-feedback" role="status">
          Period closed.
        </p>
      ) : null}
      <button
        className="secondary-button"
        type="button"
        disabled={overview.status !== "open" || closeState.status === "saving"}
        onClick={onClose}
      >
        {closeState.status === "saving" ? "Closing…" : "Close period"}
      </button>
    </section>
  );
}

function BudgetLoading() {
  return (
    <div
      className="loading-layout"
      aria-live="polite"
      aria-label="Loading budget data"
    >
      <div className="skeleton skeleton-heading" />
      <div className="content-grid">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  );
}
function BudgetError({
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
        <strong>Budgets unavailable</strong>
        <p>{error.message}</p>
      </div>
      <button className="secondary-button" type="button" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
