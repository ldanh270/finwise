import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Divider,
  Header,
  InlineError,
  Money,
  PrimaryButton,
  ScrollScreen,
  SelectField,
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
  getTransaction,
  getTransactionAudits,
  getTransactionClassification,
  getTransactionSourceLinks,
  classifyTransaction,
  listTransactions,
  listAccounts,
  listCategories,
  listTags,
  replaceTransaction,
  voidTransaction,
} from "../../src/features/ledger/ledger-service";
import { filterTransactions } from "../../src/features/ledger/transaction-search";
import {
  stableCommandKey,
  type StableCommandKeyState,
} from "../../src/sync/stable-command-key";
import {
  classificationError,
  replacementDraft,
  type ClassificationDraftLine,
  type ReplacementDraft,
} from "../../src/features/ledger/transaction-detail";

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
    let active = true;
    setCachedTransactions([]);
    void new WorkspaceCache(session.user.id, workspaceId)
      .read()
      .then((snapshot) => {
        if (!active) return;
        if (snapshot?.transactions)
          setCachedTransactions(snapshot.transactions);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id, workspaceId]);
  useEffect(() => {
    if (!session?.user.id || !workspaceId || !query.data) return;
    void new WorkspaceCache(session.user.id, workspaceId).write({
      transactions: query.data,
    });
  }, [query.data, session?.user.id, workspaceId]);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    string | null
  >(null);
  const accountsQuery = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => listAccounts(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => listCategories(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const tagsQuery = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => listTags(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
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
                    onSelect={() => setSelectedTransactionId(transaction.id)}
                  />
                ))
              )}
            </Card>
            {selectedTransactionId ? (
              <TransactionDetail
                api={api}
                workspaceId={workspaceId as string}
                transactionId={selectedTransactionId}
                accounts={accountsQuery.data ?? []}
                categories={categoriesQuery.data ?? []}
                tags={tagsQuery.data ?? []}
                accountsUnavailable={accountsQuery.isError}
                categoriesUnavailable={categoriesQuery.isError}
                tagsUnavailable={tagsQuery.isError}
                onClose={() => setSelectedTransactionId(null)}
                onChanged={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ["transactions", workspaceId],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["overview", workspaceId],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["accounts", workspaceId],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["budgets", workspaceId],
                  });
                }}
              />
            ) : null}
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
  onSelect,
}: {
  transaction: import("@finwise/api-client").TransactionSummary;
  workspaceId: string;
  onVoided: () => void;
  onSelect: () => void;
}) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const voidCommandKey = useRef<StableCommandKeyState | undefined>(undefined);
  function voidEntry() {
    const submit = (reason: string) => {
      const input = {
        reason,
        effectiveDate: new Date().toISOString().slice(0, 10),
      };
      const command = stableCommandKey(voidCommandKey.current, "mobile-void", {
        transactionId: transaction.id,
        ...input,
      });
      voidCommandKey.current = command.state;
      setBusy(true);
      void voidTransaction(api, workspaceId, transaction.id, input, command.key)
        .then(() => {
          voidCommandKey.current = undefined;
          onVoided();
        })
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open transaction ${transaction.description || transaction.id}`}
        onPress={onSelect}
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
      </Pressable>
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

function TransactionDetail({
  api,
  workspaceId,
  transactionId,
  accounts,
  categories,
  tags,
  accountsUnavailable,
  categoriesUnavailable,
  tagsUnavailable,
  onClose,
  onChanged,
}: {
  api: import("@finwise/api-client").FinwiseApiClient;
  workspaceId: string;
  transactionId: string;
  accounts: readonly import("@finwise/api-client").AccountSummary[];
  categories: readonly import("@finwise/api-client").CategorySummary[];
  tags: readonly import("@finwise/api-client").TagSummary[];
  accountsUnavailable: boolean;
  categoriesUnavailable: boolean;
  tagsUnavailable: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["transaction", workspaceId, transactionId],
    queryFn: () => getTransaction(api, workspaceId, transactionId),
  });
  const classificationQuery = useQuery({
    queryKey: ["transaction-classification", workspaceId, transactionId],
    queryFn: () =>
      getTransactionClassification(api, workspaceId, transactionId),
  });
  const auditsQuery = useQuery({
    queryKey: ["transaction-audits", workspaceId, transactionId],
    queryFn: () => getTransactionAudits(api, workspaceId, transactionId),
  });
  const sourceLinksQuery = useQuery({
    queryKey: ["transaction-source-links", workspaceId, transactionId],
    queryFn: () => getTransactionSourceLinks(api, workspaceId, transactionId),
  });
  const [classificationLines, setClassificationLines] = useState<
    ClassificationDraftLine[]
  >([]);
  const [replacement, setReplacement] = useState<ReplacementDraft | null>(null);
  const [replacementReason, setReplacementReason] = useState("");
  const [busyAction, setBusyAction] = useState<"classify" | "replace" | null>(
    null,
  );
  const [replacementCommandKey, setReplacementCommandKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!detailQuery.data) return;
    setReplacement(replacementDraft(detailQuery.data));
    setReplacementReason("");
    setReplacementCommandKey(null);
  }, [detailQuery.data]);
  useEffect(() => {
    if (!detailQuery.data || !classificationQuery.data) return;
    setClassificationLines(
      classificationQuery.data.length
        ? classificationQuery.data.map((line) => ({
            categoryId: line.categoryId,
            amountMinorUnits: line.amount.minorUnits,
            tagIds: [...line.tagIds],
          }))
        : [
            {
              categoryId: "",
              amountMinorUnits: detailQuery.data.amount.minorUnits,
              tagIds: [],
            },
          ],
    );
  }, [classificationQuery.data, detailQuery.data]);

  if (detailQuery.isPending)
    return <StatePanel title="Loading transaction detail…" />;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <StatePanel
        title="Transaction detail could not load"
        description="The journal may be unavailable or outside your workspace access."
        action={{ label: "Retry", onPress: () => void detailQuery.refetch() }}
      />
    );
  }
  const transaction = detailQuery.data;
  const replacementAccountOptions = accounts
    .filter((account) => account.status === "active")
    .map((account) => ({ label: account.name, value: account.id }));
  const categoryOptions = categories
    .filter(
      (category) =>
        category.status === "active" &&
        !categories.some(
          (child) =>
            child.status === "active" && child.parentId === category.id,
        ),
    )
    .map((category) => ({ label: category.name, value: category.id }));
  const canReplace = replacement !== null && transaction.status === "posted";
  const hasClassification = Boolean(classificationQuery.data?.length);
  const canClassify =
    transaction.status === "posted" &&
    transaction.kind !== "transfer" &&
    !hasClassification;
  const updateLine = (
    index: number,
    patch: Partial<ClassificationDraftLine>,
  ) => {
    setClassificationLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  };
  const toggleTag = (index: number, tagId: string) => {
    const current = classificationLines[index];
    if (!current) return;
    const tagIds = current.tagIds.includes(tagId)
      ? current.tagIds.filter((id) => id !== tagId)
      : [...current.tagIds, tagId];
    updateLine(index, { tagIds });
  };
  const submitClassification = () => {
    const error = classificationError(
      classificationLines,
      transaction.amount.minorUnits,
    );
    if (error) {
      Alert.alert("Check classification", error);
      return;
    }
    setBusyAction("classify");
    void classifyTransaction(api, workspaceId, transaction.id, {
      lines: classificationLines,
    })
      .then(() => {
        Alert.alert(
          "Classification saved",
          "Budget and category views will refresh.",
        );
        void classificationQuery.refetch();
        onChanged();
      })
      .catch((error: unknown) =>
        Alert.alert(
          "Could not classify",
          error instanceof Error ? error.message : "Try again when online.",
        ),
      )
      .finally(() => setBusyAction(null));
  };
  const submitReplacement = () => {
    if (!replacement) return;
    if (!replacementReason.trim()) {
      Alert.alert(
        "Reason required",
        "Corrections keep the reason in the audit trail.",
      );
      return;
    }
    if (
      !replacement.amountMinorUnits ||
      !/^\d+$/.test(replacement.amountMinorUnits)
    ) {
      Alert.alert(
        "Invalid amount",
        "Use positive VND minor units, without decimals.",
      );
      return;
    }
    if (
      !replacement.accountId ||
      (replacement.type === "transfer" && !replacement.destinationAccountId)
    ) {
      Alert.alert(
        "Account required",
        "Choose the source and destination accounts.",
      );
      return;
    }
    const commandKey =
      replacementCommandKey ?? `mobile-replace-${transaction.id}-${Date.now()}`;
    setReplacementCommandKey(commandKey);
    setBusyAction("replace");
    void replaceTransaction(
      api,
      workspaceId,
      transaction.id,
      {
        ...replacement,
        destinationAccountId:
          replacement.type === "transfer"
            ? replacement.destinationAccountId
            : undefined,
        reason: replacementReason.trim(),
      },
      commandKey,
    )
      .then(() => {
        Alert.alert(
          "Transaction corrected",
          "The original journal was reversed and replaced.",
        );
        onChanged();
        void detailQuery.refetch();
        void classificationQuery.refetch();
        void auditsQuery.refetch();
      })
      .catch((error: unknown) =>
        Alert.alert(
          "Could not correct",
          error instanceof Error ? error.message : "Try again when online.",
        ),
      )
      .finally(() => setBusyAction(null));
  };
  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Header
          eyebrow="JOURNAL DETAIL"
          title={transaction.description || "Untitled transaction"}
          subtitle={`${transaction.kind} · ${transaction.effectiveDate} · ${transaction.status}`}
        />
        <SecondaryButton label="Close" onPress={onClose} />
      </View>
      <Money value={transaction.amount} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Recorded {new Date(transaction.recordedAt).toLocaleString()}
      </Text>
      <Text style={{ color: colors.ink, fontWeight: "700" }}>Entries</Text>
      {transaction.entries?.map((entry) => (
        <View
          key={entry.id}
          style={{ flexDirection: "row", justifyContent: "space-between" }}
        >
          <Text style={{ color: colors.muted }}>{entry.accountId}</Text>
          <Text style={{ color: colors.ink }}>
            {entry.direction} · {entry.amountMinorUnits} minor units
          </Text>
        </View>
      ))}
      {hasClassification ? (
        <>
          <Divider />
          <Text style={{ color: colors.ink, fontWeight: "700" }}>
            Categories and tags
          </Text>
          {classificationQuery.data?.map((line) => (
            <View key={line.id} style={{ gap: 3 }}>
              <Text style={{ color: colors.ink }}>
                {categories.find((category) => category.id === line.categoryId)
                  ?.name ?? line.categoryId}
              </Text>
              <Text style={{ color: colors.muted }}>
                {line.amount.minorUnits} minor units
                {line.tagIds.length ? ` · ${line.tagIds.length} tag(s)` : ""}
              </Text>
            </View>
          ))}
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Classification is immutable after posting. Correct the journal to
            create a new replacement that can be classified separately.
          </Text>
        </>
      ) : null}
      {canClassify ? (
        <>
          <Divider />
          <Text style={{ color: colors.ink, fontWeight: "700" }}>
            Categories and tags
          </Text>
          {classificationQuery.isError ? (
            <>
              <InlineError message="Classification could not load. Retry to avoid overwriting unseen lines." />
              <SecondaryButton
                label="Retry classification"
                onPress={() => void classificationQuery.refetch()}
              />
            </>
          ) : null}
          {categoriesUnavailable ? (
            <InlineError message="Categories are unavailable. Retry the screen before classifying." />
          ) : null}
          {tagsUnavailable ? (
            <InlineError message="Tags are unavailable; classification can still be saved without tags." />
          ) : null}
          {classificationQuery.isPending ? (
            <Text style={{ color: colors.muted }}>
              Loading saved classification…
            </Text>
          ) : null}
          {classificationLines.map((line, index) => (
            <View key={`line-${index}`} style={{ gap: 8 }}>
              <SelectField
                label={`Line ${index + 1} category`}
                value={line.categoryId}
                options={categoryOptions}
                onChange={(categoryId) => updateLine(index, { categoryId })}
              />
              <TextField
                label="Amount (minor units)"
                value={line.amountMinorUnits}
                onChangeText={(amountMinorUnits) =>
                  updateLine(index, { amountMinorUnits })
                }
                keyboardType="number-pad"
              />
              {tags.length ? (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {tags
                    .filter((tag) => tag.status === "active")
                    .map((tag) => (
                      <Pressable
                        key={tag.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{
                          checked: line.tagIds.includes(tag.id),
                        }}
                        onPress={() => toggleTag(index, tag.id)}
                        style={{
                          borderWidth: 1,
                          borderColor: line.tagIds.includes(tag.id)
                            ? colors.teal
                            : colors.border,
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          backgroundColor: line.tagIds.includes(tag.id)
                            ? colors.tealSoft
                            : colors.surface,
                        }}
                      >
                        <Text style={{ color: colors.ink, fontSize: 12 }}>
                          {tag.name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ) : null}
              {classificationLines.length > 1 ? (
                <SecondaryButton
                  label="Remove line"
                  onPress={() =>
                    setClassificationLines((current) =>
                      current.filter((_, lineIndex) => lineIndex !== index),
                    )
                  }
                />
              ) : null}
            </View>
          ))}
          <SecondaryButton
            label="Add category line"
            onPress={() =>
              setClassificationLines((current) => [
                ...current,
                { categoryId: "", amountMinorUnits: "0", tagIds: [] },
              ])
            }
          />
          <PrimaryButton
            label={
              busyAction === "classify"
                ? "Saving classification…"
                : "Save classification"
            }
            onPress={submitClassification}
            disabled={
              busyAction !== null ||
              !classificationLines.length ||
              !categoryOptions.length ||
              classificationQuery.isError
            }
          />
        </>
      ) : null}
      {canReplace ? (
        <>
          <Divider />
          <Text style={{ color: colors.ink, fontWeight: "700" }}>
            Correct posted journal
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 19 }}>
            Corrections require an online response and preserve the original in
            the audit chain.
          </Text>
          <TextField
            label="Amount (minor units)"
            value={replacement.amountMinorUnits}
            onChangeText={(amountMinorUnits) =>
              setReplacement(
                (current) => current && { ...current, amountMinorUnits },
              )
            }
            keyboardType="number-pad"
          />
          <SelectField
            label="Source account"
            value={replacement.accountId}
            options={replacementAccountOptions}
            onChange={(accountId) =>
              setReplacement((current) => current && { ...current, accountId })
            }
          />
          {replacement.type === "transfer" ? (
            <SelectField
              label="Destination account"
              value={replacement.destinationAccountId}
              options={replacementAccountOptions.filter(
                (option) => option.value !== replacement.accountId,
              )}
              onChange={(destinationAccountId) =>
                setReplacement(
                  (current) => current && { ...current, destinationAccountId },
                )
              }
            />
          ) : null}
          <TextField
            label="Effective date"
            value={replacement.effectiveDate}
            onChangeText={(effectiveDate) =>
              setReplacement(
                (current) => current && { ...current, effectiveDate },
              )
            }
            autoCapitalize="none"
          />
          <TextField
            label="Description"
            value={replacement.description}
            onChangeText={(description) =>
              setReplacement(
                (current) => current && { ...current, description },
              )
            }
          />
          <TextField
            label="Correction reason"
            value={replacementReason}
            onChangeText={setReplacementReason}
            multiline
          />
          <PrimaryButton
            label={
              busyAction === "replace" ? "Correcting…" : "Reverse and replace"
            }
            onPress={submitReplacement}
            disabled={
              busyAction !== null ||
              !replacementAccountOptions.length ||
              accountsUnavailable
            }
          />
        </>
      ) : null}
      <Divider />
      <Text style={{ color: colors.ink, fontWeight: "700" }}>
        Audit history
      </Text>
      {auditsQuery.isPending ? (
        <Text style={{ color: colors.muted }}>Loading audit history…</Text>
      ) : auditsQuery.isError ? (
        <>
          <InlineError message="Audit history could not load." />
          <SecondaryButton
            label="Retry audit history"
            onPress={() => void auditsQuery.refetch()}
          />
        </>
      ) : auditsQuery.data?.length ? (
        auditsQuery.data.map((audit) => (
          <Text key={audit.id} style={{ color: colors.muted }}>
            {audit.action} · {new Date(audit.createdAt).toLocaleString()}
          </Text>
        ))
      ) : (
        <Text style={{ color: colors.muted }}>No audit entries.</Text>
      )}
      <Text style={{ color: colors.ink, fontWeight: "700" }}>
        Source evidence
      </Text>
      {sourceLinksQuery.isPending ? (
        <Text style={{ color: colors.muted }}>Loading source links…</Text>
      ) : sourceLinksQuery.isError ? (
        <>
          <InlineError message="Source evidence could not load." />
          <SecondaryButton
            label="Retry source evidence"
            onPress={() => void sourceLinksQuery.refetch()}
          />
        </>
      ) : sourceLinksQuery.data?.length ? (
        sourceLinksQuery.data.map((link) => (
          <Text key={link.id} style={{ color: colors.muted }}>
            {link.sourceType} · {link.sourceId}
          </Text>
        ))
      ) : (
        <Text style={{ color: colors.muted }}>No source links.</Text>
      )}
    </Card>
  );
}
