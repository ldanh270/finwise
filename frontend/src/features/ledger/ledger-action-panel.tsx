"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/ui/icons";
import type { AccountSummary, ApiError } from "../../lib/api/contracts";
import {
  accountOptions,
  createAccount,
  createTransaction,
  postOpeningBalance,
} from "./ledger-service";

type Props = {
  workspaceId: string | null;
  accounts: AccountSummary[];
  mode: "account" | "opening" | "transaction";
  onSuccess: () => void;
};

type ActionState =
  | { status: "idle" | "saving" }
  | { status: "success" }
  | { status: "error"; error: ApiError };

export function LedgerActionPanel({
  workspaceId,
  accounts,
  mode,
  onSuccess,
}: Props) {
  const visibleAccounts = accountOptions(accounts);
  const [state, setState] = useState<ActionState>({ status: "idle" });
  const [accountId, setAccountId] = useState(visibleAccounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    visibleAccounts[1]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"cash" | "bank" | "savings" | "other">(
    "cash",
  );
  const [type, setType] = useState<"income" | "expense" | "transfer">(
    "expense",
  );
  const [amountMinorUnits, setAmountMinorUnits] = useState("");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());

  useEffect(() => {
    if (visibleAccounts.some((account) => account.id === accountId)) return;
    // The account list changes after workspace switching; keep the command scoped to a visible account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountId(visibleAccounts[0]?.id ?? "");
  }, [accountId, visibleAccounts]);

  useEffect(() => {
    if (visibleAccounts.some((account) => account.id === destinationAccountId))
      return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDestinationAccountId(
      visibleAccounts[1]?.id ?? visibleAccounts[0]?.id ?? "",
    );
  }, [destinationAccountId, visibleAccounts]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    setState({ status: "saving" });
    const result =
      mode === "account"
        ? await createAccount(workspaceId, { name, kind })
        : mode === "opening"
          ? await postOpeningBalance(workspaceId, accountId, {
              amountMinorUnits,
              effectiveDate,
              description: description || undefined,
            })
          : await createTransaction(workspaceId, {
              type,
              amountMinorUnits,
              accountId,
              destinationAccountId:
                type === "transfer" ? destinationAccountId : undefined,
              effectiveDate,
              description: description || undefined,
            });
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return;
    }
    setState({ status: "success" });
    setName("");
    setAmountMinorUnits("");
    setDescription("");
    onSuccess();
  }

  const title =
    mode === "account"
      ? "Add account"
      : mode === "opening"
        ? "Opening balance"
        : "Record movement";
  return (
    <section
      className="resource-panel ledger-action-panel"
      aria-labelledby={`ledger-action-${mode}`}
    >
      <div className="resource-toolbar">
        <span id={`ledger-action-${mode}`}>{title}</span>
        <span className="resource-hint">
          <Icon name="shield" width={14} height={14} /> Server-authorized
        </span>
      </div>
      <form className="ledger-action-form" onSubmit={submit}>
        {mode === "account" ? (
          <>
            <label>
              Account name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
              />
            </label>
            <label>
              Type
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="savings">Savings</option>
                <option value="other">Other</option>
              </select>
            </label>
          </>
        ) : (
          <>
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
                {visibleAccounts.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            {mode === "transaction" ? (
              <label>
                Movement type
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as typeof type)
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
            ) : null}
            {mode === "transaction" && type === "transfer" ? (
              <label>
                Destination
                <select
                  value={destinationAccountId}
                  onChange={(event) =>
                    setDestinationAccountId(event.target.value)
                  }
                  required
                >
                  <option value="" disabled>
                    Select destination
                  </option>
                  {visibleAccounts
                    .filter((account) => account.id !== accountId)
                    .map((account) => (
                      <option value={account.id} key={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
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
          </>
        )}
        {state.status === "error" ? (
          <p className="inline-feedback is-error" role="alert">
            {state.error.message}
          </p>
        ) : null}
        {state.status === "success" ? (
          <p className="inline-feedback" role="status">
            Saved. Balances and recent activity refreshed.
          </p>
        ) : null}
        <button
          className="primary-button"
          type="submit"
          disabled={
            state.status === "saving" ||
            (mode !== "account" && visibleAccounts.length === 0)
          }
          aria-busy={state.status === "saving"}
        >
          {state.status === "saving" ? "Saving…" : "Save"}
        </button>
        {mode !== "account" && visibleAccounts.length === 0 ? (
          <p className="form-help">Add a visible account first.</p>
        ) : null}
      </form>
    </section>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
