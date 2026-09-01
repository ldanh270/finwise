import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Divider,
  Header,
  InlineError,
  Money,
  PrimaryButton,
  ScrollScreen,
  SecondaryButton,
  StatePanel,
  TextField,
  colors,
} from "../../src/ui/components";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";
import { WorkspaceCache } from "../../src/cache/workspace-cache";
import {
  exportTransactions as exportTransactionsCsv,
  listTransactions,
  voidTransaction,
} from "../../src/features/ledger/ledger-service";
import { filterTransactions } from "../../src/features/ledger/transaction-search";

export default function TransactionsRoute() {
  const { api, session } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["transactions", workspaceId],
    queryFn: () => listTransactions(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const [cachedTransactions, setCachedTransactions] = useState<
    readonly import("@finwise/api-client").TransactionSummary[]
  >([]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId) return;
    setCachedTransactions([]);
    void new WorkspaceCache(session.user.id, workspaceId)
      .read()
      .then((snapshot) => {
        if (snapshot?.transactions)
          setCachedTransactions(snapshot.transactions);
      });
  }, [session?.user.id, workspaceId]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId || !query.data) return;
    void new WorkspaceCache(session.user.id, workspaceId).write({
      transactions: query.data,
    });
  }, [query.data, session?.user.id, workspaceId]);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  async function exportTransactions() {
    if (!workspaceId) return;
    setExporting(true);
    try {
      const csv = await exportTransactionsCsv(api, workspaceId);
      const directory =
        FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!directory)
        throw new Error("File storage is unavailable on this device.");
      const uri = `${directory}finwise-transactions-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
          dialogTitle: "Export Finwise transactions",
        });
      } else {
        Alert.alert("Export ready", "The CSV was saved on this device.");
      }
    } catch (error: unknown) {
      Alert.alert(
        "Could not export",
        error instanceof Error ? error.message : "Try again when online.",
      );
    } finally {
      setExporting(false);
    }
  }
  const allTransactions = query.data ?? cachedTransactions;
  const visibleTransactions = filterTransactions(allTransactions, search);
  return (
    <AppShell active="transactions">
      <ScrollScreen>
        <Header
          eyebrow="MONEY"
          title="Transactions"
          subtitle="Confirmed ledger movement stays immutable and auditable."
        />
        <PrimaryButton
          label="Record a transaction"
          onPress={() => router.push("/(app)/transaction/new")}
        />
        <SecondaryButton
          label={exporting ? "Preparing CSV…" : "Export transactions"}
          disabled={exporting || !workspaceId}
          onPress={() => void exportTransactions()}
        />
        <TextField
          label="Search transactions"
          value={search}
          onChangeText={setSearch}
          placeholder="Description, type, date, or amount"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.isPending && cachedTransactions.length === 0 ? (
          <StatePanel title="Loading transactions…" />
        ) : query.isError && cachedTransactions.length === 0 ? (
          <StatePanel
            title="Transactions could not load"
            description={
              query.error instanceof Error
                ? query.error.message
                : "Retry when the API is available."
            }
            action={{ label: "Retry", onPress: () => void query.refetch() }}
          />
        ) : (
          <>
            {query.isError ? (
              <InlineError message="Showing cached transactions. Retry when the API is available." />
            ) : null}
            <Card>
              <Header
                eyebrow="RECENT ACTIVITY"
                title={
                  search.trim()
                    ? `${visibleTransactions.length} of ${allTransactions.length} entries`
                    : `${allTransactions.length} entries`
                }
              />
              {!visibleTransactions.length ? (
                <StatePanel
                  title={
                    search.trim()
                      ? "No matching transactions"
                      : "No transactions yet"
                  }
                  description={
                    search.trim()
                      ? "Try a different description, type, date, or amount."
                      : "Income, expense, transfer, and opening balance entries will appear here."
                  }
                />
              ) : (
                visibleTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    workspaceId={workspaceId as string}
                    onVoided={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ["transactions", workspaceId],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["overview", workspaceId],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["accounts", workspaceId],
                      });
                    }}
                  />
                ))
              )}
            </Card>
          </>
        )}
      </ScrollScreen>
    </AppShell>
  );
}

function TransactionRow({
  transaction,
  workspaceId,
  onVoided,
}: {
  transaction: import("@finwise/api-client").TransactionSummary;
  workspaceId: string;
  onVoided: () => void;
}) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  function voidEntry() {
    const submit = (reason: string) => {
      setBusy(true);
      void voidTransaction(
        api,
        workspaceId,
        transaction.id,
        { reason, effectiveDate: new Date().toISOString().slice(0, 10) },
        `mobile-void-${transaction.id}`,
      )
        .then(onVoided)
        .catch((error: unknown) =>
          Alert.alert(
            "Could not void",
            error instanceof Error ? error.message : "Try again when online.",
          ),
        )
        .finally(() => setBusy(false));
    };
    if (Platform.OS !== "ios") {
      Alert.alert("Void transaction", "Keep the reason in the audit trail.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Void",
          style: "destructive",
          onPress: () => submit("Voided from mobile."),
        },
      ]);
      return;
    }
    Alert.prompt(
      "Void transaction",
      "Keep the reason in the audit trail.",
      (reason) => {
        if (reason?.trim()) submit(reason.trim());
      },
      "plain-text",
    );
  }
  return (
    <View style={{ gap: 7 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 15 }}>
            {transaction.description || "Untitled transaction"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {transaction.kind} · {transaction.effectiveDate} ·{" "}
            {transaction.status}
          </Text>
        </View>
        <Money value={transaction.amount} compact />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          ID {transaction.id.slice(0, 10)}
        </Text>
        {transaction.status === "posted" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Void transaction ${transaction.description || transaction.id}`}
            disabled={busy}
            onPress={voidEntry}
          >
            <Text
              style={{
                color: busy ? colors.muted : colors.danger,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {busy ? "Voiding…" : "Void"}
            </Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.amber, fontSize: 11 }}>Reversal</Text>
        )}
      </View>
      <Divider />
    </View>
  );
}
