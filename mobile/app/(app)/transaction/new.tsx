import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../src/ui/app-shell";
import {
  Card,
  Header,
  InlineError,
  PrimaryButton,
  ScrollScreen,
  SelectField,
  StatePanel,
  TextField,
} from "../../../src/ui/components";
import { useAuth } from "../../../src/auth/auth-context";
import { useWorkspace } from "../../../src/app/providers";
import { FinwiseApiError } from "@finwise/api-client";
import { MobileOutboxRepository } from "../../../src/sync/mobile-outbox-repository";
import { manualTransactionSchema } from "../../../src/validation/forms";
import { WorkspaceCache } from "../../../src/cache/workspace-cache";
import {
  createTransaction,
  listAccounts,
  listBudgets,
} from "../../../src/features/ledger/ledger-service";
import type { ManualTransactionForm } from "../../../src/validation/forms";
import {
  stableCommandKey,
  type StableCommandKeyState,
} from "../../../src/sync/stable-command-key";

type TransactionKind = "income" | "expense" | "transfer";
type OnlineTransactionCommand = {
  readonly input: ManualTransactionForm;
  readonly clientCommandId: string;
};

export default function NewTransactionRoute() {
  const { api, session } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => listAccounts(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const budgetsQuery = useQuery({
    queryKey: ["budgets", workspaceId],
    queryFn: () => listBudgets(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const [cachedAccounts, setCachedAccounts] = useState<
    readonly import("@finwise/api-client").AccountSummary[]
  >([]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId) return;
    let active = true;
    setCachedAccounts([]);
    void new WorkspaceCache(session.user.id, workspaceId)
      .read()
      .then((snapshot) => {
        if (!active) return;
        if (snapshot?.accounts) setCachedAccounts(snapshot.accounts);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id, workspaceId]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId || !accountsQuery.data) return;
    void new WorkspaceCache(session.user.id, workspaceId).write({
      accounts: accountsQuery.data,
    });
  }, [accountsQuery.data, session?.user.id, workspaceId]);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [feedback, setFeedback] = useState<string | null>(null);
  const commandRef = useRef<StableCommandKeyState | undefined>(undefined);
  const mutation = useMutation({
    mutationFn: (command: OnlineTransactionCommand) =>
      createTransaction(
        api,
        workspaceId as string,
        command.input,
        command.clientCommandId,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["overview", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["transactions", workspaceId],
      });
      router.replace("/(app)/transactions");
    },
    onError: async (error: Error, command: OnlineTransactionCommand) => {
      if (
        command.input.type !== "transfer" &&
        workspaceId &&
        session?.user.id &&
        isTransient(error)
      ) {
        const repository = new MobileOutboxRepository(
          session.user.id,
          workspaceId,
          api,
        );
        await repository.createAndQueue({
          clientCommandId: command.clientCommandId,
          userId: session.user.id,
          workspaceId,
          accountId: command.input.accountId,
          kind: command.input.type,
          amount: {
            currency: command.input.currency,
            minorUnits: command.input.amountMinorUnits,
          },
          effectiveDate: command.input.effectiveDate,
          ...(command.input.description
            ? { description: command.input.description }
            : {}),
          ...(command.input.budgetId
            ? { budgetId: command.input.budgetId }
            : {}),
        });
        setFeedback(
          "Saved as an offline draft. It will sync when the connection returns.",
        );
        return;
      }
      setFeedback(error.message);
    },
  });
  const accounts = accountsQuery.data ?? cachedAccounts;
  const accountOptions = accounts
    .filter((account) => account.status === "active")
    .map((account) => ({
      label: `${account.name} (${account.currency})`,
      value: account.id,
    }));
  const budgetOptions = [
    { label: "Unassigned", value: "" },
    ...(budgetsQuery.data ?? [])
      .filter((budget) => budget.status === "active")
      .map((budget) => ({ label: budget.name, value: budget.id })),
  ];
  const [budgetId, setBudgetId] = useState("");
  const sourceAccount = accounts.find((account) => account.id === accountId);
  const destinationAccount = accounts.find(
    (account) => account.id === destinationAccountId,
  );
  const crossCurrency =
    kind === "transfer" &&
    sourceAccount !== undefined &&
    destinationAccount !== undefined &&
    sourceAccount.currency !== destinationAccount.currency;
  function submit() {
    const parsed = manualTransactionSchema.safeParse({
      type: kind,
      accountId,
      ...(kind === "transfer" ? { destinationAccountId } : {}),
      ...(kind !== "transfer" && budgetId ? { budgetId } : {}),
      currency: sourceAccount?.currency ?? "VND",
      ...(kind === "transfer" && destinationAccount
        ? { destinationCurrency: destinationAccount.currency }
        : {}),
      ...(kind === "transfer" && destinationAmount.trim()
        ? { destinationAmountMinorUnits: destinationAmount.trim() }
        : {}),
      ...(kind === "transfer" && exchangeRate.trim()
        ? { exchangeRate: exchangeRate.trim() }
        : {}),
      amountMinorUnits: amount.trim(),
      effectiveDate,
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    if (
      !workspaceId ||
      !parsed.success ||
      (kind === "transfer" && !destinationAccountId)
    ) {
      setFeedback(
        parsed.success
          ? "Choose both accounts for a transfer."
          : (parsed.error.issues[0]?.message ?? "Check the form fields."),
      );
      return;
    }
    const input: ManualTransactionForm = parsed.data;
    if (
      crossCurrency &&
      !input.destinationAmountMinorUnits &&
      !input.exchangeRate
    ) {
      setFeedback("Enter the received amount or an exchange rate.");
      return;
    }
    const command = stableCommandKey(
      commandRef.current,
      "mobile-transaction",
      input,
    );
    commandRef.current = command.state;
    mutation.mutate({
      input,
      clientCommandId: command.key,
    });
  }
  return (
    <AppShell active="create">
      <ScrollScreen>
        <Header
          eyebrow="QUICK ADD"
          title="Record movement"
          subtitle="Transfers and corrections stay online-only; the server confirms balances."
        />
        {accountsQuery.isPending && accountOptions.length === 0 ? (
          <StatePanel title="Loading accounts…" />
        ) : accountsQuery.isError && accountOptions.length === 0 ? (
          <StatePanel
            title="Accounts could not load"
            description={
              accountsQuery.error instanceof Error
                ? accountsQuery.error.message
                : "Retry when the API is available."
            }
            action={{
              label: "Retry",
              onPress: () => void accountsQuery.refetch(),
            }}
          />
        ) : accountOptions.length === 0 ? (
          <StatePanel
            title="Add an account first"
            description="A visible active account is required before recording income, expense, or transfer movement."
            action={{
              label: "Manage accounts",
              onPress: () => router.push("/(app)/accounts"),
            }}
          />
        ) : (
          <Card>
            {accountsQuery.isError ? (
              <InlineError message="Showing cached accounts. The draft can sync when the connection returns." />
            ) : null}
            <TextField
              label={`Amount (${sourceAccount?.currency ?? "account currency"} minor units)`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="125000"
              autoFocus
            />
            <SelectField
              label="Type"
              value={kind}
              onChange={(value) => setKind(value as TransactionKind)}
              options={[
                { label: "Expense", value: "expense" },
                { label: "Income", value: "income" },
                { label: "Transfer", value: "transfer" },
              ]}
            />
            <SelectField
              label={kind === "transfer" ? "From account" : "Account"}
              value={accountId}
              onChange={setAccountId}
              options={accountOptions}
            />
            {kind === "transfer" ? (
              <SelectField
                label="To account"
                value={destinationAccountId}
                onChange={setDestinationAccountId}
                options={accountOptions.filter(
                  (option) => option.value !== accountId,
                )}
              />
            ) : null}
            {crossCurrency ? (
              <>
                <TextField
                  label={`Received amount (${destinationAccount?.currency ?? "destination currency"} minor units, optional)`}
                  value={destinationAmount}
                  onChangeText={setDestinationAmount}
                  keyboardType="number-pad"
                  placeholder="2000000"
                />
                <TextField
                  label={`Exchange rate (1 ${sourceAccount?.currency ?? "source currency"} = ${destinationAccount?.currency ?? "destination currency"}, optional)`}
                  value={exchangeRate}
                  onChangeText={setExchangeRate}
                  keyboardType="decimal-pad"
                  placeholder="20000"
                />
              </>
            ) : null}
            {kind !== "transfer" ? (
              <SelectField
                label="Budget (optional)"
                value={budgetId}
                onChange={setBudgetId}
                options={budgetOptions}
              />
            ) : null}
            <TextField
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Lunch"
            />
            <TextField
              label="Effective date (YYYY-MM-DD)"
              value={effectiveDate}
              onChangeText={setEffectiveDate}
              placeholder="2026-09-01"
            />
            {feedback ? <InlineError message={feedback} /> : null}
            <PrimaryButton
              label={mutation.isPending ? "Posting…" : "Post transaction"}
              disabled={mutation.isPending}
              onPress={submit}
            />
          </Card>
        )}
      </ScrollScreen>
    </AppShell>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function isTransient(error: Error): boolean {
  return !(error instanceof FinwiseApiError) || error.status >= 500;
}
