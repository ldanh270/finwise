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
  const [cachedAccounts, setCachedAccounts] = useState<
    readonly import("@finwise/api-client").AccountSummary[]
  >([]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId) return;
    setCachedAccounts([]);
    void new WorkspaceCache(session.user.id, workspaceId)
      .read()
      .then((snapshot) => {
        if (snapshot?.accounts) setCachedAccounts(snapshot.accounts);
      });
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
  const [description, setDescription] = useState("");
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
            currency: "VND",
            minorUnits: command.input.amountMinorUnits,
          },
          effectiveDate: command.input.effectiveDate,
          ...(command.input.description
            ? { description: command.input.description }
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
    .map((account) => ({ label: account.name, value: account.id }));
  function submit() {
    const parsed = manualTransactionSchema.safeParse({
      type: kind,
      accountId,
      ...(kind === "transfer" ? { destinationAccountId } : {}),
      amountMinorUnits: amount.trim(),
      effectiveDate: today(),
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
    <AppShell active="transactions">
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
            <TextField
              label="Amount (VND minor units)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="125000"
            />
            <TextField
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Lunch"
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
