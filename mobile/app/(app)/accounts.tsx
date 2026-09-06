import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Header,
  InlineError,
  Money,
  PrimaryButton,
  ScrollScreen,
  SelectField,
  StatePanel,
  TextField,
  colors,
  Divider,
} from "../../src/ui/components";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";
import { WorkspaceCache } from "../../src/cache/workspace-cache";
import {
  createAccount as createAccountRequest,
  listAccounts,
  postOpeningBalance,
} from "../../src/features/ledger/ledger-service";
import {
  stableCommandKey,
  type StableCommandKeyState,
} from "../../src/sync/stable-command-key";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@finwise/api-client";

export default function AccountsRoute() {
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
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"cash" | "bank" | "savings" | "liability">(
    "cash",
  );
  const [currency, setCurrency] = useState<CurrencyCode>("VND");
  const [iconKey, setIconKey] = useState("cash");
  const [initialAmount, setInitialAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [opening, setOpening] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const openingCommandKey = useRef<StableCommandKeyState | undefined>(
    undefined,
  );
  const createMutation = useMutation({
    mutationFn: () =>
      createAccountRequest(api, workspaceId as string, {
        name: name.trim(),
        kind,
        currency,
        iconKey,
        openingBalanceMinorUnits: initialAmount.trim() || "0",
      }),
    onSuccess: async () => {
      setName("");
      setInitialAmount("");
      setFeedback("Account created.");
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["overview", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const openingMutation = useMutation({
    mutationFn: (command: {
      accountId: string;
      amountMinorUnits: string;
      currency: CurrencyCode;
      effectiveDate: string;
      idempotencyKey: string;
    }) =>
      postOpeningBalance(
        api,
        workspaceId as string,
        command.accountId,
        {
          amountMinorUnits: command.amountMinorUnits,
          currency: command.currency,
          effectiveDate: command.effectiveDate,
        },
        command.idempotencyKey,
      ),
    onSuccess: async () => {
      setOpening("");
      openingCommandKey.current = undefined;
      setFeedback("Opening balance posted.");
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["overview", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const accounts = accountsQuery.data ?? cachedAccounts;
  useEffect(() => {
    const activeAccount = accounts.find(
      (account) => account.status === "active" && account.id === accountId,
    );
    if (activeAccount || !accountId) return;
    setAccountId(
      accounts.find((account) => account.status === "active")?.id ?? "",
    );
  }, [accountId, accounts]);

  function createAccount() {
    if (!workspaceId || !name.trim()) {
      setFeedback("Account name is required.");
      return;
    }
    createMutation.mutate();
  }
  function postOpening() {
    if (
      !workspaceId ||
      !accountId ||
      !/^\d+$/.test(opening.trim()) ||
      BigInt(opening.trim()) <= 0n
    ) {
      setFeedback(
        "Choose an account and enter a positive VND minor-unit amount.",
      );
      return;
    }
    const currency =
      accounts.find((account) => account.id === accountId)?.currency ?? "VND";
    const commandInput = {
      accountId,
      amountMinorUnits: opening.trim(),
      currency,
      effectiveDate: today(),
    };
    const commandKey = stableCommandKey(
      openingCommandKey.current,
      "mobile-opening",
      commandInput,
    );
    openingCommandKey.current = commandKey.state;
    openingMutation.mutate({
      accountId,
      amountMinorUnits: opening.trim(),
      currency,
      effectiveDate: commandInput.effectiveDate,
      idempotencyKey: commandKey.key,
    });
  }

  return (
    <AppShell active="accounts">
      <ScrollScreen>
        <Header
          eyebrow="MONEY"
          title="Accounts"
          subtitle="Every visible place your money lives, with balances from the ledger."
        />
        {accountsQuery.isPending && accounts.length === 0 ? (
          <StatePanel title="Loading accounts…" />
        ) : accountsQuery.isError && accounts.length === 0 ? (
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
        ) : (
          <>
            {accountsQuery.isError ? (
              <InlineError message="Showing cached accounts. Retry when the API is available." />
            ) : null}
            <Card>
              <Header eyebrow="NEW ACCOUNT" title="Add an account" />
              <TextField
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Cash wallet"
              />
              <SelectField
                label="Type"
                value={kind}
                onChange={(value) => setKind(value as typeof kind)}
                options={[
                  { label: "Cash", value: "cash" },
                  { label: "Bank", value: "bank" },
                  { label: "Savings", value: "savings" },
                  { label: "Other", value: "liability" },
                ]}
              />
              <SelectField
                label="Icon"
                value={iconKey}
                onChange={setIconKey}
                options={[
                  { label: "▣ Cash", value: "cash" },
                  { label: "◉ Wallet", value: "wallet" },
                  { label: "◉ Bank", value: "bank" },
                  { label: "◉ Savings", value: "savings" },
                  { label: "◉ Card", value: "card" },
                ]}
              />
              <SelectField
                label="Currency"
                value={currency}
                onChange={(value) => setCurrency(value as CurrencyCode)}
                options={SUPPORTED_CURRENCIES.map((code) => ({
                  label: code,
                  value: code,
                }))}
              />
              <TextField
                label={`Opening amount (${currency} minor units)`}
                value={initialAmount}
                onChangeText={setInitialAmount}
                keyboardType="number-pad"
                placeholder="0"
              />
              <PrimaryButton
                label={
                  createMutation.isPending ? "Creating…" : "Create account"
                }
                disabled={createMutation.isPending}
                onPress={createAccount}
              />
            </Card>
            {accounts.length ? (
              <Card>
                <Header eyebrow="OPENING BALANCE" title="Seed the ledger" />
                <SelectField
                  label="Account"
                  value={accountId}
                  onChange={setAccountId}
                  options={accounts
                    .filter((account) => account.status === "active")
                    .map((account) => ({
                      label: account.name,
                      value: account.id,
                    }))}
                />
                <TextField
                  label={`Amount (${accounts.find((account) => account.id === accountId)?.currency ?? "account currency"} minor units)`}
                  value={opening}
                  onChangeText={setOpening}
                  keyboardType="number-pad"
                  placeholder="1000000"
                />
                <PrimaryButton
                  label={
                    openingMutation.isPending
                      ? "Posting…"
                      : "Post opening balance"
                  }
                  disabled={openingMutation.isPending}
                  onPress={postOpening}
                />
              </Card>
            ) : (
              <StatePanel
                title="Your first account unlocks the dashboard"
                description="Add a cash or bank account, then post an opening balance when you are ready."
              />
            )}
            {feedback ? <InlineError message={feedback} /> : null}
            <Card>
              <Header
                eyebrow="VISIBLE ACCOUNTS"
                title={`${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
              />
              {accounts.length === 0 ? (
                <Text style={{ color: colors.muted }}>No accounts yet.</Text>
              ) : (
                accounts.map((account) => (
                  <View key={account.id} style={{ gap: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View>
                        <Text
                          style={{
                            color: colors.ink,
                            fontWeight: "700",
                            fontSize: 16,
                          }}
                        >
                          {account.name}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {account.iconKey} · {account.kind} ·{" "}
                          {account.currency}
                        </Text>
                      </View>
                      <Money
                        value={{
                          currency: account.currency,
                          minorUnits: account.balanceMinorUnits,
                        }}
                        compact
                      />
                    </View>
                    <Divider />
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollScreen>
    </AppShell>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
