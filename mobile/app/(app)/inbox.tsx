import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Alert, Text, View } from "react-native";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Divider,
  Header,
  InlineError,
  Money,
  PrimaryButton,
  SecondaryButton,
  ScrollScreen,
  SelectField,
  StatePanel,
  TextField,
  colors,
} from "../../src/ui/components";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";

export default function InboxRoute() {
  const { api } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => api.getAccounts(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const sessionsQuery = useQuery({
    queryKey: ["imports", workspaceId],
    queryFn: () => api.getImportSessions(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const transactionsQuery = useQuery({
    queryKey: ["transactions", workspaceId],
    queryFn: () => api.getTransactions(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const reconciliationsQuery = useQuery({
    queryKey: ["reconciliations", workspaceId],
    queryFn: () => api.getReconciliations(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const sessionId = selectedSessionId ?? sessionsQuery.data?.[0]?.id;
  const recordsQuery = useQuery({
    queryKey: ["import-records", workspaceId, sessionId],
    queryFn: () =>
      api.getImportedRecords(workspaceId as string, sessionId as string),
    enabled: Boolean(workspaceId && sessionId),
  });
  const [accountId, setAccountId] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("pasted-import.csv");
  const [statementDate, setStatementDate] = useState(today());
  const [externalBalance, setExternalBalance] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    const latestSessionId = sessionsQuery.data?.[0]?.id;
    if (!latestSessionId) {
      setSelectedSessionId(undefined);
      return;
    }
    if (
      selectedSessionId &&
      sessionsQuery.data?.some((session) => session.id === selectedSessionId)
    ) {
      return;
    }
    setSelectedSessionId(latestSessionId);
  }, [selectedSessionId, sessionsQuery.data]);
  const importMutation = useMutation({
    mutationFn: () =>
      api.createImportSession(workspaceId as string, {
        accountId,
        fileName,
        csvContent,
      }),
    onSuccess: async (result) => {
      setFeedback(
        result.duplicate
          ? "This file was already imported."
          : "CSV received. Review rows below.",
      );
      setCsvContent("");
      setFileName("pasted-import.csv");
      await queryClient.invalidateQueries({
        queryKey: ["imports", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const reconcileMutation = useMutation({
    mutationFn: () =>
      api.startReconciliation(workspaceId as string, {
        accountId,
        statementDate,
        externalBalanceMinorUnits: externalBalance.trim(),
      }),
    onSuccess: async () => {
      setFeedback("Reconciliation checkpoint created.");
      await queryClient.invalidateQueries({
        queryKey: ["reconciliations", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const deleteRawMutation = useMutation({
    mutationFn: (sessionToDelete: string) =>
      api.deleteImportRaw(workspaceId as string, sessionToDelete),
    onSuccess: async () => {
      setFeedback("Raw CSV data deleted. Normalized evidence is retained.");
      await queryClient.invalidateQueries({
        queryKey: ["imports", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const accountOptions = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.status === "active")
        .map((account) => ({ label: account.name, value: account.id })),
    [accountsQuery.data],
  );
  useEffect(() => {
    if (
      !accountId ||
      accountOptions.some((option) => option.value === accountId)
    )
      return;
    setAccountId("");
  }, [accountId, accountOptions]);
  function importCsv() {
    if (!workspaceId || !accountId || !csvContent.trim()) {
      setFeedback("Choose an account and add CSV content.");
      return;
    }
    importMutation.mutate();
  }
  async function pickCsvFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) {
        return;
      }
      const file = result.assets[0];
      if (!file) {
        return;
      }
      const content = await FileSystem.readAsStringAsync(file.uri);
      setCsvContent(content);
      setFileName(file.name || "mobile-import.csv");
      setFeedback(
        `Loaded ${file.name || "CSV file"}. Review before importing.`,
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "The selected CSV file could not be read.",
      );
    }
  }
  function startCheckpoint() {
    if (!workspaceId || !accountId || !/^\d+$/.test(externalBalance.trim())) {
      setFeedback(
        "Choose an account and enter an external balance in minor units.",
      );
      return;
    }
    reconcileMutation.mutate();
  }
  const primaryQueriesUnavailable =
    (accountsQuery.isError && !accountsQuery.data) ||
    (sessionsQuery.isError && !sessionsQuery.data) ||
    (reconciliationsQuery.isError && !reconciliationsQuery.data);
  const primaryQueriesLoading =
    (accountsQuery.isPending && !accountsQuery.data) ||
    (sessionsQuery.isPending && !sessionsQuery.data) ||
    (reconciliationsQuery.isPending && !reconciliationsQuery.data);
  function retryInboxReads() {
    void Promise.all([
      accountsQuery.refetch(),
      sessionsQuery.refetch(),
      transactionsQuery.refetch(),
      reconciliationsQuery.refetch(),
      ...(sessionId ? [recordsQuery.refetch()] : []),
    ]);
  }
  if (primaryQueriesLoading) {
    return <InboxGate title="Loading inbox and reconciliation data…" />;
  }
  if (primaryQueriesUnavailable) {
    return (
      <InboxGate
        title="Inbox data could not load"
        description="Your account, import, or reconciliation data is unavailable."
        onRetry={retryInboxReads}
      />
    );
  }
  return (
    <AppShell active="inbox">
      <ScrollScreen>
        <Header
          eyebrow="INBOX & CONTROL"
          title="Imports & reconciliation"
          subtitle="Review evidence before it changes the immutable ledger."
        />
        {accountsQuery.isError && accountsQuery.data ? (
          <InlineError message="Showing the last account list. Retry before submitting a new import or checkpoint." />
        ) : null}
        {transactionsQuery.isError ? (
          <InlineError message="Existing transactions could not load, so matching imported rows is temporarily unavailable." />
        ) : null}
        <Card>
          <Header eyebrow="CSV INBOX" title="Review a CSV" />
          <SelectField
            label="Account"
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
          />
          <SecondaryButton
            label="Choose CSV file"
            onPress={() => void pickCsvFile()}
          />
          <TextField
            label="CSV content"
            value={csvContent}
            onChangeText={setCsvContent}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <PrimaryButton
            label={importMutation.isPending ? "Reviewing…" : "Review CSV"}
            disabled={importMutation.isPending}
            onPress={importCsv}
          />
          {sessionsQuery.isError ? (
            <View style={{ gap: 8 }}>
              <InlineError message="Import sessions could not load." />
              <SecondaryButton
                label="Retry sessions"
                onPress={retryInboxReads}
              />
            </View>
          ) : sessionsQuery.data?.length ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {sessionsQuery.data.length} import session
                {sessionsQuery.data.length === 1 ? "" : "s"}. Select one to
                review normalized rows.
              </Text>
              {sessionsQuery.data.map((session) => (
                <View
                  key={session.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <SecondaryButton
                    label={`${session.fileName} · ${session.status}`}
                    onPress={() => setSelectedSessionId(session.id)}
                    disabled={session.id === sessionId}
                  />
                  {!session.rawDeletedAt ? (
                    <SecondaryButton
                      label={
                        deleteRawMutation.isPending ? "Deleting…" : "Delete raw"
                      }
                      onPress={() => {
                        Alert.alert(
                          "Delete raw CSV?",
                          "Normalized rows and audit evidence stay available, but the original file cannot be recovered.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete raw",
                              style: "destructive",
                              onPress: () =>
                                deleteRawMutation.mutate(session.id),
                            },
                          ],
                        );
                      }}
                      disabled={deleteRawMutation.isPending}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              No import sessions yet.
            </Text>
          )}
        </Card>
        <Card>
          <Header eyebrow="NORMALIZED RECORDS" title="Confirm one time" />
          {recordsQuery.isPending ? (
            <Text style={{ color: colors.muted }}>Loading rows…</Text>
          ) : recordsQuery.isError ? (
            <View style={{ gap: 8 }}>
              <InlineError message="Normalized rows could not load." />
              <SecondaryButton
                label="Retry rows"
                onPress={() => void recordsQuery.refetch()}
              />
            </View>
          ) : !recordsQuery.data?.length ? (
            <Text style={{ color: colors.muted }}>
              Select or create an import session to review rows.
            </Text>
          ) : (
            recordsQuery.data.map((record) => (
              <RecordRow
                key={record.id}
                workspaceId={workspaceId as string}
                record={record}
                api={api}
                transactionOptions={(transactionsQuery.data ?? []).map(
                  (transaction) => ({
                    label: `${transaction.effectiveDate} · ${transaction.description || transaction.kind} · ${transaction.amount.minorUnits}`,
                    value: transaction.id,
                  }),
                )}
                onChanged={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ["import-records", workspaceId, sessionId],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["overview", workspaceId],
                  });
                }}
              />
            ))
          )}
        </Card>
        <Card>
          <Header eyebrow="RECONCILIATION" title="Checkpoint" />
          <SelectField
            label="Account"
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
          />
          <TextField
            label="Statement date"
            value={statementDate}
            onChangeText={setStatementDate}
            placeholder="2026-09-01"
          />
          <TextField
            label="External balance (minor units)"
            value={externalBalance}
            onChangeText={setExternalBalance}
            keyboardType="number-pad"
            placeholder="1000000"
          />
          <PrimaryButton
            label={
              reconcileMutation.isPending ? "Starting…" : "Start checkpoint"
            }
            disabled={reconcileMutation.isPending}
            onPress={startCheckpoint}
          />
          {reconciliationsQuery.isError ? (
            <View style={{ gap: 8 }}>
              <InlineError message="Reconciliation checkpoints could not load." />
              <SecondaryButton
                label="Retry checkpoints"
                onPress={retryInboxReads}
              />
            </View>
          ) : (
            reconciliationsQuery.data?.map((checkpoint) => (
              <ReconciliationRow
                key={checkpoint.id}
                workspaceId={workspaceId as string}
                checkpoint={checkpoint}
                api={api}
                onChanged={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ["reconciliations", workspaceId],
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
        {feedback ? <InlineError message={feedback} /> : null}
      </ScrollScreen>
    </AppShell>
  );
}

function InboxGate({
  title,
  description,
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <AppShell active="inbox">
      <ScrollScreen>
        <Header
          eyebrow="INBOX & CONTROL"
          title="Imports & reconciliation"
          subtitle="Review evidence before it changes the immutable ledger."
        />
        <StatePanel
          title={title}
          description={description}
          action={onRetry ? { label: "Retry", onPress: onRetry } : undefined}
        />
      </ScrollScreen>
    </AppShell>
  );
}

function RecordRow({
  workspaceId,
  record,
  api,
  transactionOptions,
  onChanged,
}: {
  workspaceId: string;
  record: import("@finwise/api-client").ImportedRecordSummary;
  api: import("@finwise/api-client").FinwiseApiClient;
  transactionOptions: readonly { label: string; value: string }[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState(
    record.matchedTransactionId ?? "",
  );
  const confirm = useMutation({
    mutationFn: () =>
      api.confirmImportedRecord(
        workspaceId,
        record.id,
        `mobile-import-${record.id}`,
      ),
    onSuccess: onChanged,
    onError: (value: Error) => setError(value.message),
  });
  const ignore = useMutation({
    mutationFn: () =>
      api.decideImportedRecord(
        workspaceId,
        record.id,
        "ignore",
        "Ignored from mobile inbox.",
      ),
    onSuccess: onChanged,
    onError: (value: Error) => setError(value.message),
  });
  const match = useMutation({
    mutationFn: () =>
      api.matchImportedRecord(workspaceId, record.id, transactionId),
    onSuccess: onChanged,
    onError: (value: Error) => setError(value.message),
  });
  const attention = useMutation({
    mutationFn: () =>
      api.decideImportedRecord(
        workspaceId,
        record.id,
        "needs-attention",
        "Requires manual attention from mobile inbox.",
      ),
    onSuccess: onChanged,
    onError: (value: Error) => setError(value.message),
  });
  const busy =
    confirm.isPending ||
    ignore.isPending ||
    match.isPending ||
    attention.isPending;
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
          <Text style={{ color: colors.ink, fontWeight: "700" }}>
            {record.description || "Imported row"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {record.effectiveDate} · {record.status}
          </Text>
        </View>
        <Money value={record.amount} compact />
      </View>
      {record.status === "needs_review" || record.status === "matched" ? (
        <>
          <SelectField
            label="Match existing transaction (does not post)"
            value={transactionId}
            onChange={setTransactionId}
            options={transactionOptions}
          />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <SecondaryButton
              label={match.isPending ? "Matching…" : "Match"}
              disabled={busy || !transactionId}
              onPress={() => match.mutate()}
            />
            <SecondaryButton
              label={attention.isPending ? "Saving…" : "Needs attention"}
              disabled={busy}
              onPress={() => attention.mutate()}
            />
          </View>
        </>
      ) : null}
      {record.status === "needs_review" || record.status === "matched" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <PrimaryButton
            label={confirm.isPending ? "…" : "Confirm"}
            disabled={busy}
            onPress={() => confirm.mutate()}
          />
          <PrimaryButton
            label={ignore.isPending ? "…" : "Ignore"}
            disabled={busy}
            onPress={() => ignore.mutate()}
          />
        </View>
      ) : null}
      {error ? <InlineError message={error} /> : null}
      <Divider />
    </View>
  );
}

function ReconciliationRow({
  workspaceId,
  checkpoint,
  api,
  onChanged,
}: {
  workspaceId: string;
  checkpoint: import("@finwise/api-client").ReconciliationSummary;
  api: import("@finwise/api-client").FinwiseApiClient;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("Mobile reconciliation adjustment");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const adjust = useMutation({
    mutationFn: () =>
      api.adjustReconciliation(workspaceId, checkpoint.id, {
        amountMinorUnits: absoluteMinorUnits(checkpoint.difference.minorUnits),
        reason: reason.trim(),
        effectiveDate,
      }),
    onSuccess: onChanged,
    onError: (value: Error) => setError(value.message),
  });
  const canAdjust =
    checkpoint.status === "open" && checkpoint.difference.minorUnits !== "0";
  return (
    <View style={{ gap: 7 }}>
      <Divider />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.ink, fontWeight: "700" }}>
          {checkpoint.statementDate}
        </Text>
        <Text style={{ color: colors.muted }}>{checkpoint.status}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Difference</Text>
      <Money value={checkpoint.difference} compact />
      {canAdjust ? (
        <>
          <TextField
            label="Adjustment reason"
            value={reason}
            onChangeText={setReason}
          />
          <TextField
            label="Effective date"
            value={effectiveDate}
            onChangeText={setEffectiveDate}
            placeholder="2026-09-01"
          />
          <PrimaryButton
            label={adjust.isPending ? "Adjusting…" : "Post adjustment"}
            disabled={adjust.isPending || !reason.trim()}
            onPress={() => {
              setError(null);
              adjust.mutate();
            }}
          />
        </>
      ) : null}
      {error ? <InlineError message={error} /> : null}
    </View>
  );
}

function absoluteMinorUnits(value: string): string {
  try {
    const amount = BigInt(value);
    return (amount < 0n ? -amount : amount).toString();
  } catch {
    return "0";
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
