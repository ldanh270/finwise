import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Header,
  InlineError,
  Money,
  PrimaryButton,
  ScrollScreen,
  StatePanel,
  colors,
  Divider,
  formatMoney,
} from "../../src/ui/components";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";
import { useEffect, useState } from "react";
import { WorkspaceCache } from "../../src/cache/workspace-cache";
import {
  getBalanceViews,
  getOverview,
} from "../../src/features/overview/overview-service";

export default function OverviewRoute() {
  const { api, session } = useAuth();
  const { workspaceId } = useWorkspace();
  const overviewQuery = useQuery({
    queryKey: ["overview", workspaceId],
    queryFn: () => getOverview(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const balanceQuery = useQuery({
    queryKey: ["balances", workspaceId],
    queryFn: () => getBalanceViews(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const [cachedOverview, setCachedOverview] =
    useState<import("@finwise/api-client").OverviewResponse>();
  const [cachedBalances, setCachedBalances] = useState<
    readonly import("@finwise/api-client").BalanceViewSummary[]
  >([]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId) return;
    let active = true;
    setCachedOverview(undefined);
    setCachedBalances([]);
    const cache = new WorkspaceCache(session.user.id, workspaceId);
    void cache.read().then((snapshot) => {
      if (!active) return;
      if (snapshot?.overview) setCachedOverview(snapshot.overview);
      if (snapshot?.balances) setCachedBalances(snapshot.balances);
    });
    return () => {
      active = false;
    };
  }, [session?.user.id, workspaceId]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId || !overviewQuery.data) return;
    void new WorkspaceCache(session.user.id, workspaceId).write({
      overview: overviewQuery.data,
    });
  }, [overviewQuery.data, session?.user.id, workspaceId]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId || !balanceQuery.data) return;
    void new WorkspaceCache(session.user.id, workspaceId).write({
      balances: balanceQuery.data,
    });
  }, [balanceQuery.data, session?.user.id, workspaceId]);
  const overview = overviewQuery.data ?? cachedOverview;

  return (
    <AppShell active="overview">
      <ScrollScreen>
        <Header
          eyebrow="MONTHLY OVERVIEW"
          title={`Good morning${workspaceId ? `, ${firstName(session?.user.displayName)}` : ""}`}
          subtitle="A calm view of your confirmed money movement."
        />
        {overviewQuery.isPending && !overview ? (
          <StatePanel title="Loading your workspace…" />
        ) : overviewQuery.isError && !overview ? (
          <StatePanel
            title="We could not load this overview"
            description={friendlyError(overviewQuery.error)}
            action={{
              label: "Retry",
              onPress: () => void overviewQuery.refetch(),
            }}
          />
        ) : overview ? (
          <>
            {overviewQuery.isError ? (
              <InlineError message="Showing the last cached overview. Pull to retry when online." />
            ) : null}
            {overview.hasPartialAccess ? <PartialAccessNotice /> : null}
            <ViewCards overview={overview} />
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Header eyebrow="ACTIVITY" title="Recent transactions" />
                <PrimaryButton
                  label="Add"
                  onPress={() => router.push("/(app)/transaction/new")}
                />
              </View>
              {overview.recentTransactions.length === 0 ? (
                <TextMuted text="No transactions yet. Add your first income or expense." />
              ) : (
                overview.recentTransactions.slice(0, 5).map((transaction) => (
                  <View key={transaction.id} style={{ gap: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <TextStrong
                          text={
                            transaction.description || "Untitled transaction"
                          }
                        />
                        <TextMuted
                          text={`${transaction.accountName} · ${transaction.date}`}
                        />
                      </View>
                      <Money value={transaction.amount} compact />
                    </View>
                    <Divider />
                  </View>
                ))
              )}
            </Card>
            <Card>
              <Header
                eyebrow="VISIBLE ACCOUNTS"
                title="Your money, your view"
              />
              <TextMuted
                text={`${overview.accounts.length} visible account${overview.accounts.length === 1 ? "" : "s"}`}
              />
              {balanceQuery.isPending &&
              !balanceQuery.data &&
              cachedBalances.length === 0 ? (
                <TextMuted text="Loading balance detail…" />
              ) : balanceQuery.isError && cachedBalances.length === 0 ? (
                <InlineError message="Balance detail is temporarily unavailable." />
              ) : (
                (balanceQuery.data ?? cachedBalances)
                  .slice(0, 3)
                  .map((balance) => (
                    <View
                      key={balance.accountId}
                      style={{
                        gap: 3,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <TextMuted
                          text={
                            overview.accounts.find(
                              (account) => account.id === balance.accountId,
                            )?.name ?? "Visible account"
                          }
                        />
                        <Money value={balance.ledger} compact />
                      </View>
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 11,
                          lineHeight: 16,
                        }}
                      >
                        Ledger{" "}
                        {formatMoney(
                          balance.ledger.minorUnits,
                          balance.ledger.currency,
                        )}{" "}
                        {balance.ledger.currency} · Cleared{" "}
                        {formatMoney(
                          balance.cleared.minorUnits,
                          balance.cleared.currency,
                        )}{" "}
                        {balance.cleared.currency} · Reconciled{" "}
                        {formatMoney(
                          balance.reconciled.minorUnits,
                          balance.reconciled.currency,
                        )}{" "}
                        {balance.reconciled.currency}
                      </Text>
                      <Divider />
                    </View>
                  ))
              )}
              {balanceQuery.isError && cachedBalances.length > 0 ? (
                <InlineError message="Showing cached balances. Retry when the API is available." />
              ) : null}
              <PrimaryButton
                label="Manage accounts"
                onPress={() => router.push("/(app)/accounts")}
              />
            </Card>
          </>
        ) : (
          <StatePanel
            title="Choose a workspace to get started"
            description="Create an account or switch workspace to begin tracking."
            action={{
              label: "Manage accounts",
              onPress: () => router.push("/(app)/accounts"),
            }}
          />
        )}
      </ScrollScreen>
    </AppShell>
  );
}

function ViewCards({
  overview,
}: {
  overview: import("@finwise/api-client").OverviewResponse;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Card
        style={{ backgroundColor: colors.tealSoft, borderColor: "#c5e3de" }}
      >
        <TextMuted text="Total balance" />
        <Money value={overview.totals.accountBalance} />
        {overview.accountBalances.length > 1 ? (
          <View style={{ gap: 4 }}>
            <TextMuted text="Balances by currency" />
            {overview.accountBalances.map((balance) => (
              <View
                key={balance.currency}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <TextMuted text={balance.currency} />
                <Money value={balance} compact />
              </View>
            ))}
          </View>
        ) : null}
      </Card>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <TextMuted text="Income" />
          <Money value={overview.totals.income} compact />
        </Card>
        <Card style={{ flex: 1 }}>
          <TextMuted text="Spent" />
          <Money value={overview.totals.spending} compact />
        </Card>
      </View>
      <Card>
        <TextMuted text="Budget remaining" />
        <Money value={overview.totals.budgetRemaining} compact />
      </Card>
    </View>
  );
}

function PartialAccessNotice() {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: "#fff8e8",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <Text style={{ color: colors.amber, fontSize: 12, lineHeight: 18 }}>
        Some account data is hidden based on your workspace permissions.
      </Text>
    </View>
  );
}

function TextMuted({ text }: { text: string }) {
  return (
    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
      {text}
    </Text>
  );
}
function TextStrong({ text }: { text: string }) {
  return (
    <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>
      {text}
    </Text>
  );
}
function friendlyError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Check your connection and retry.";
}

function firstName(displayName: string | undefined): string {
  return displayName?.trim().split(/\s+/)[0] || "there";
}
