import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Alert, Pressable, Text, View } from "react-native";
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
  SelectField,
  StatePanel,
  TextField,
  colors,
  formatVnd,
} from "../../src/ui/components";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";
import {
  ReceiptStagingStore,
  type StagedReceipt,
} from "../../src/cache/receipt-staging";
import {
  stableCommandKey,
  type StableCommandKeyState,
} from "../../src/sync/stable-command-key";

export default function GroupRoute() {
  const { api, session } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const collectionsQuery = useQuery({
    queryKey: ["group-collections", workspaceId],
    queryFn: () => api.getGroupCollections(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const reportQuery = useQuery({
    queryKey: ["group-report", workspaceId],
    queryFn: () => api.getGroupReportSummary(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const accountsQuery = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => api.getAccounts(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const participantsQuery = useQuery({
    queryKey: ["group-participants", workspaceId],
    queryFn: () => api.getGroupParticipants(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const membersQuery = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => api.getWorkspaceMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const claimsQuery = useQuery({
    queryKey: ["group-claims", workspaceId],
    queryFn: () => api.getGroupClaims(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const payablesQuery = useQuery({
    queryKey: ["group-payables", workspaceId],
    queryFn: () => api.getGroupPayables(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const sponsoredQuery = useQuery({
    queryKey: ["group-sponsored", workspaceId],
    queryFn: () => api.getGroupSponsoredExpenses(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const directExpensesQuery = useQuery({
    queryKey: ["group-expenses", workspaceId],
    queryFn: () => api.getGroupDirectExpenses(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const [collectionName, setCollectionName] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [participantMemberId, setParticipantMemberId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [obligationParticipantId, setObligationParticipantId] = useState("");
  const [obligationAmount, setObligationAmount] = useState("");
  const [submissionParticipantId, setSubmissionParticipantId] = useState("");
  const [submissionAmount, setSubmissionAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [claimantId, setClaimantId] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [claimDescription, setClaimDescription] = useState("");
  const [sponsoredAmount, setSponsoredAmount] = useState("");
  const [sponsoredDescription, setSponsoredDescription] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const directExpenseCommandKey = useRef<StableCommandKeyState | undefined>(
    undefined,
  );
  const receiptStore = useMemo(
    () =>
      session?.user.id && workspaceId
        ? new ReceiptStagingStore(session.user.id, workspaceId)
        : null,
    [session?.user.id, workspaceId],
  );
  const [stagedReceipts, setStagedReceipts] = useState<
    readonly StagedReceipt[]
  >([]);
  const selectedCollectionIdValue =
    selectedCollectionId || collectionsQuery.data?.[0]?.id || "";
  const obligationsQuery = useQuery({
    queryKey: ["group-obligations", workspaceId, selectedCollectionIdValue],
    queryFn: () =>
      api.getGroupObligations(workspaceId as string, selectedCollectionIdValue),
    enabled: Boolean(workspaceId && selectedCollectionIdValue),
  });
  const submissionsQuery = useQuery({
    queryKey: ["group-submissions", workspaceId, selectedCollectionIdValue],
    queryFn: () =>
      api.getGroupSubmissions(workspaceId as string, selectedCollectionIdValue),
    enabled: Boolean(workspaceId && selectedCollectionIdValue),
  });
  async function loadStagedReceipts() {
    if (!receiptStore) return;
    setStagedReceipts(await receiptStore.list());
  }
  useEffect(() => {
    void loadStagedReceipts();
  }, [receiptStore]);
  async function stageReceipt() {
    if (!receiptStore) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;
      await receiptStore.stage({
        fileName: result.assets[0].name,
        fileUri: result.assets[0].uri,
        ...(result.assets[0].mimeType
          ? { mimeType: result.assets[0].mimeType }
          : {}),
        ...(result.assets[0].size !== undefined
          ? { sizeBytes: result.assets[0].size }
          : {}),
      });
      await loadStagedReceipts();
      setFeedback(
        "Receipt staged locally. It will not post or alter the ledger.",
      );
    } catch (error: unknown) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "The receipt could not be staged.",
      );
    }
  }
  const createCollection = useMutation({
    mutationFn: () =>
      api.createGroupCollection(workspaceId as string, {
        name: collectionName.trim(),
      }),
    onSuccess: async () => {
      setCollectionName("");
      setFeedback("Collection created.");
      await queryClient.invalidateQueries({
        queryKey: ["group-collections", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const createParticipant = useMutation({
    mutationFn: () =>
      api.createGroupParticipant(workspaceId as string, {
        memberId: participantMemberId,
        displayName: participantName.trim(),
      }),
    onSuccess: async () => {
      setParticipantMemberId("");
      setParticipantName("");
      setFeedback("Participant added.");
      await queryClient.invalidateQueries({
        queryKey: ["group-participants", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const createObligation = useMutation({
    mutationFn: () =>
      api.addGroupObligation(workspaceId as string, selectedCollectionIdValue, {
        participantId: obligationParticipantId,
        amountMinorUnits: obligationAmount.trim(),
      }),
    onSuccess: async () => {
      setObligationAmount("");
      setFeedback("Collection obligation added.");
      await queryClient.invalidateQueries({
        queryKey: ["group-obligations", workspaceId, selectedCollectionIdValue],
      });
      await queryClient.invalidateQueries({
        queryKey: ["group-progress", workspaceId, selectedCollectionIdValue],
      });
      await queryClient.invalidateQueries({
        queryKey: ["group-report", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const createSubmission = useMutation({
    mutationFn: () =>
      api.createGroupSubmission(
        workspaceId as string,
        selectedCollectionIdValue,
        {
          participantId: submissionParticipantId,
          accountId,
          amountMinorUnits: submissionAmount.trim(),
        },
      ),
    onSuccess: async () => {
      setSubmissionAmount("");
      setFeedback("Contribution submitted for verification.");
      await queryClient.invalidateQueries({
        queryKey: ["group-submissions", workspaceId, selectedCollectionIdValue],
      });
      await queryClient.invalidateQueries({
        queryKey: ["group-report", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const createSponsored = useMutation({
    mutationFn: () =>
      api.createGroupSponsoredExpense(workspaceId as string, {
        amountMinorUnits: sponsoredAmount.trim(),
        description: sponsoredDescription.trim(),
      }),
    onSuccess: async () => {
      setSponsoredAmount("");
      setSponsoredDescription("");
      setFeedback("Sponsored expense recorded.");
      await queryClient.invalidateQueries({
        queryKey: ["group-sponsored", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["group-report", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const postExpense = useMutation({
    mutationFn: (command: {
      accountId: string;
      amountMinorUnits: string;
      description: string;
      effectiveDate: string;
      idempotencyKey: string;
    }) =>
      api.createDirectGroupExpense(
        workspaceId as string,
        {
          accountId: command.accountId,
          amountMinorUnits: command.amountMinorUnits,
          description: command.description,
          effectiveDate: command.effectiveDate,
        },
        command.idempotencyKey,
      ),
    onSuccess: async () => {
      directExpenseCommandKey.current = undefined;
      setAmount("");
      setDescription("");
      setFeedback("Group expense posted.");
      await queryClient.invalidateQueries({
        queryKey: ["group-report", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["overview", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const createClaim = useMutation({
    mutationFn: () =>
      api.createGroupClaim(workspaceId as string, {
        claimantParticipantId: claimantId,
        accountId,
        amountMinorUnits: claimAmount.trim(),
        description: claimDescription.trim(),
      }),
    onSuccess: async () => {
      setClaimAmount("");
      setClaimDescription("");
      setFeedback("Claim submitted for review.");
      await queryClient.invalidateQueries({
        queryKey: ["group-claims", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["group-report", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const activeAccounts = useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.status === "active")
        .map((account) => ({ label: account.name, value: account.id })),
    [accountsQuery.data],
  );
  useEffect(() => {
    if (!collectionsQuery.data?.length) {
      if (selectedCollectionId) setSelectedCollectionId("");
      return;
    }
    if (
      selectedCollectionId &&
      collectionsQuery.data.some(
        (collection) => collection.id === selectedCollectionId,
      )
    ) {
      return;
    }
    setSelectedCollectionId(collectionsQuery.data[0]?.id ?? "");
  }, [collectionsQuery.data, selectedCollectionId]);
  useEffect(() => {
    if (
      !accountId ||
      activeAccounts.some((account) => account.value === accountId)
    )
      return;
    setAccountId(activeAccounts[0]?.value ?? "");
  }, [accountId, activeAccounts]);
  const participantOptions = useMemo(
    () =>
      (participantsQuery.data ?? [])
        .filter((participant) => participant.status === "active")
        .map((participant) => ({
          label: participant.displayName,
          value: participant.id,
        })),
    [participantsQuery.data],
  );
  const memberOptions = useMemo(
    () =>
      (membersQuery.data ?? [])
        .filter((member) => member.status === "active")
        .map((member) => ({ label: member.userId, value: member.id })),
    [membersQuery.data],
  );
  const collectionOptions = useMemo(
    () =>
      (collectionsQuery.data ?? []).map((collection) => ({
        label: `${collection.name} · ${collection.status}`,
        value: collection.id,
      })),
    [collectionsQuery.data],
  );
  function create() {
    if (!workspaceId || !collectionName.trim()) {
      setFeedback("Collection name is required.");
      return;
    }
    createCollection.mutate();
  }
  function post() {
    if (
      !workspaceId ||
      !accountId ||
      !description.trim() ||
      !/^\d+$/.test(amount.trim()) ||
      BigInt(amount.trim()) <= 0n
    ) {
      setFeedback(
        "Choose an account and enter a positive amount and description.",
      );
      return;
    }
    const commandInput = {
      accountId,
      amountMinorUnits: amount.trim(),
      description: description.trim(),
      effectiveDate: today(),
    };
    const commandKey = stableCommandKey(
      directExpenseCommandKey.current,
      "mobile-group-expense",
      commandInput,
    );
    directExpenseCommandKey.current = commandKey.state;
    postExpense.mutate({
      accountId,
      amountMinorUnits: amount.trim(),
      description: description.trim(),
      effectiveDate: commandInput.effectiveDate,
      idempotencyKey: commandKey.key,
    });
  }
  function validatePositiveAmount(value: string): boolean {
    return /^\d+$/.test(value.trim()) && BigInt(value.trim()) > 0n;
  }
  function addParticipant() {
    if (!workspaceId || !participantMemberId || !participantName.trim()) {
      setFeedback("Choose a workspace member and enter a participant name.");
      return;
    }
    createParticipant.mutate();
  }
  function addObligation() {
    if (
      !workspaceId ||
      !selectedCollectionIdValue ||
      !obligationParticipantId ||
      !validatePositiveAmount(obligationAmount)
    ) {
      setFeedback(
        "Choose a collection/participant and enter a positive amount.",
      );
      return;
    }
    createObligation.mutate();
  }
  function submitContribution() {
    if (
      !workspaceId ||
      !selectedCollectionIdValue ||
      !submissionParticipantId ||
      !accountId ||
      !validatePositiveAmount(submissionAmount)
    ) {
      setFeedback(
        "Choose a collection, participant, account, and positive amount.",
      );
      return;
    }
    createSubmission.mutate();
  }
  function createSponsoredExpense() {
    if (
      !workspaceId ||
      !sponsoredDescription.trim() ||
      !validatePositiveAmount(sponsoredAmount)
    ) {
      setFeedback("Enter a positive sponsored amount and description.");
      return;
    }
    createSponsored.mutate();
  }
  return (
    <AppShell active="group">
      <ScrollScreen>
        <Header
          eyebrow="SHARED MONEY"
          title="Group Treasury"
          subtitle="Collections, direct treasury spending, and reimbursements stay distinct."
        />
        {reportQuery.data ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Metric
              label="Received"
              value={reportQuery.data.collectionReceived}
            />
            <Metric
              label="Outstanding"
              value={reportQuery.data.collectionOutstanding}
            />
          </View>
        ) : null}
        {collectionsQuery.isError || reportQuery.isError ? (
          <StatePanel
            title="Group data could not load"
            description="Check membership and retry."
            action={{
              label: "Retry",
              onPress: () => {
                void collectionsQuery.refetch();
                void reportQuery.refetch();
              },
            }}
          />
        ) : (
          <>
            {accountsQuery.isError ||
            participantsQuery.isError ||
            membersQuery.isError ||
            claimsQuery.isError ||
            payablesQuery.isError ||
            sponsoredQuery.isError ||
            directExpensesQuery.isError ? (
              <InlineError message="Some Group Treasury details are unavailable. Retry the affected section when the API is available." />
            ) : null}
            <Card>
              <Header eyebrow="COLLECTIONS" title="Campaigns" />
              {collectionsQuery.isPending ? (
                <Text style={{ color: colors.muted }}>Loading campaigns…</Text>
              ) : !collectionsQuery.data?.length ? (
                <Text style={{ color: colors.muted }}>
                  No collection campaigns yet.
                </Text>
              ) : (
                collectionsQuery.data.map((collection) => (
                  <CollectionRow
                    key={collection.id}
                    workspaceId={workspaceId as string}
                    collection={collection}
                    api={api}
                  />
                ))
              )}
              <TextField
                label="New collection"
                value={collectionName}
                onChangeText={setCollectionName}
                placeholder="September family fund"
              />
              <PrimaryButton
                label={
                  createCollection.isPending ? "Creating…" : "Create collection"
                }
                disabled={createCollection.isPending}
                onPress={create}
              />
            </Card>
            <Card>
              <Header eyebrow="PARTICIPANTS" title="People in the treasury" />
              {participantsQuery.isError || membersQuery.isError ? (
                <InlineError message="Participants or members could not load." />
              ) : null}
              {participantsQuery.data?.length ? (
                participantsQuery.data.map((participant) => (
                  <View key={participant.id} style={{ gap: 3 }}>
                    <Text style={{ color: colors.ink, fontWeight: "700" }}>
                      {participant.displayName}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {participant.status} · member{" "}
                      {participant.memberId.slice(0, 10)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.muted }}>
                  No participants yet. Add one from an active workspace member.
                </Text>
              )}
              {memberOptions.length ? (
                <>
                  <SelectField
                    label="Workspace member"
                    value={participantMemberId}
                    onChange={setParticipantMemberId}
                    options={memberOptions}
                  />
                  <TextField
                    label="Display name"
                    value={participantName}
                    onChangeText={setParticipantName}
                    placeholder="Alex"
                  />
                  <PrimaryButton
                    label={
                      createParticipant.isPending
                        ? "Adding…"
                        : "Add participant"
                    }
                    disabled={createParticipant.isPending}
                    onPress={addParticipant}
                  />
                </>
              ) : null}
            </Card>
            {selectedCollectionIdValue ? (
              <Card>
                <Header
                  eyebrow="COLLECTION CONTROL"
                  title="Obligations & submissions"
                />
                <SelectField
                  label="Collection"
                  value={selectedCollectionIdValue}
                  onChange={setSelectedCollectionId}
                  options={collectionOptions}
                />
                <Text style={{ color: colors.ink, fontWeight: "700" }}>
                  Obligations
                </Text>
                {obligationsQuery.isPending ? (
                  <Text style={{ color: colors.muted }}>
                    Loading obligations…
                  </Text>
                ) : obligationsQuery.isError ? (
                  <InlineError message="Obligations could not load." />
                ) : obligationsQuery.data?.length ? (
                  obligationsQuery.data.map((obligation) => (
                    <View key={obligation.id} style={{ gap: 3 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ color: colors.ink }}>
                          {participantNameFor(
                            participantOptions,
                            obligation.participantId,
                          )}
                        </Text>
                        <Money value={obligation.amount} compact />
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Paid <Money value={obligation.paid} compact />
                      </Text>
                      <Divider />
                    </View>
                  ))
                ) : (
                  <Text style={{ color: colors.muted }}>
                    No obligations yet.
                  </Text>
                )}
                {participantOptions.length ? (
                  <>
                    <SelectField
                      label="Participant"
                      value={obligationParticipantId}
                      onChange={setObligationParticipantId}
                      options={participantOptions}
                    />
                    <TextField
                      label="Obligation amount (VND minor units)"
                      value={obligationAmount}
                      onChangeText={setObligationAmount}
                      keyboardType="number-pad"
                      placeholder="500000"
                    />
                    <PrimaryButton
                      label={
                        createObligation.isPending
                          ? "Adding…"
                          : "Add obligation"
                      }
                      disabled={createObligation.isPending}
                      onPress={addObligation}
                    />
                  </>
                ) : null}
                <Divider />
                <Text style={{ color: colors.ink, fontWeight: "700" }}>
                  Contribution submissions
                </Text>
                {submissionsQuery.isPending ? (
                  <Text style={{ color: colors.muted }}>
                    Loading submissions…
                  </Text>
                ) : submissionsQuery.isError ? (
                  <InlineError message="Submissions could not load." />
                ) : submissionsQuery.data?.length ? (
                  submissionsQuery.data.map((submission) => (
                    <SubmissionRow
                      key={submission.id}
                      workspaceId={workspaceId as string}
                      submission={submission}
                      onChanged={() => {
                        void queryClient.invalidateQueries({
                          queryKey: [
                            "group-submissions",
                            workspaceId,
                            selectedCollectionIdValue,
                          ],
                        });
                        void queryClient.invalidateQueries({
                          queryKey: [
                            "group-obligations",
                            workspaceId,
                            selectedCollectionIdValue,
                          ],
                        });
                        void queryClient.invalidateQueries({
                          queryKey: ["group-report", workspaceId],
                        });
                      }}
                    />
                  ))
                ) : (
                  <Text style={{ color: colors.muted }}>
                    No submissions yet.
                  </Text>
                )}
                {participantOptions.length && activeAccounts.length ? (
                  <>
                    <SelectField
                      label="Submitting participant"
                      value={submissionParticipantId}
                      onChange={setSubmissionParticipantId}
                      options={participantOptions}
                    />
                    <SelectField
                      label="Source account"
                      value={accountId}
                      onChange={setAccountId}
                      options={activeAccounts}
                    />
                    <TextField
                      label="Submitted amount (VND minor units)"
                      value={submissionAmount}
                      onChangeText={setSubmissionAmount}
                      keyboardType="number-pad"
                      placeholder="500000"
                    />
                    <PrimaryButton
                      label={
                        createSubmission.isPending
                          ? "Submitting…"
                          : "Submit contribution"
                      }
                      disabled={createSubmission.isPending}
                      onPress={submitContribution}
                    />
                  </>
                ) : (
                  <Text style={{ color: colors.muted }}>
                    Add a participant and visible account before submitting.
                  </Text>
                )}
              </Card>
            ) : null}
            <Card>
              <Header eyebrow="CLAIMS" title="Submit a reimbursement claim" />
              {participantOptions.length ? (
                <SelectField
                  label="Participant"
                  value={claimantId}
                  onChange={setClaimantId}
                  options={participantOptions}
                />
              ) : (
                <Text style={{ color: colors.muted }}>
                  Add a participant before submitting a claim.
                </Text>
              )}
              <SelectField
                label="Account"
                value={accountId}
                onChange={setAccountId}
                options={activeAccounts}
              />
              <TextField
                label="Amount (VND minor units)"
                value={claimAmount}
                onChangeText={setClaimAmount}
                keyboardType="number-pad"
                placeholder="180000"
              />
              <TextField
                label="Description"
                value={claimDescription}
                onChangeText={setClaimDescription}
                placeholder="Taxi to venue"
              />
              <SecondaryButton
                label="Stage receipt (local)"
                disabled={!receiptStore}
                onPress={() => void stageReceipt()}
              />
              {stagedReceipts.length ? (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {stagedReceipts.length} receipt
                    {stagedReceipts.length === 1 ? "" : "s"} staged locally
                  </Text>
                  {stagedReceipts.slice(-3).map((receipt) => (
                    <View
                      key={receipt.id}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.ink,
                          fontSize: 12,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {receipt.fileName}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${receipt.fileName}`}
                        onPress={() => {
                          if (!receiptStore) return;
                          void receiptStore
                            .remove(receipt.id)
                            .then(loadStagedReceipts);
                        }}
                        hitSlop={8}
                      >
                        <Text style={{ color: colors.danger, fontSize: 12 }}>
                          Remove
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <PrimaryButton
                label={createClaim.isPending ? "Submitting…" : "Submit claim"}
                disabled={createClaim.isPending || !participantOptions.length}
                onPress={() => {
                  if (
                    !claimantId ||
                    !accountId ||
                    !claimDescription.trim() ||
                    !/^\d+$/.test(claimAmount.trim()) ||
                    BigInt(claimAmount.trim()) <= 0n
                  ) {
                    setFeedback(
                      "Choose a participant/account and enter a positive claim amount.",
                    );
                    return;
                  }
                  createClaim.mutate();
                }}
              />
              {claimsQuery.isError ? (
                <InlineError message="Claims could not load." />
              ) : claimsQuery.data?.length ? (
                claimsQuery.data.map((claim) => (
                  <ClaimRow
                    key={claim.id}
                    workspaceId={workspaceId as string}
                    claim={claim}
                    api={api}
                    accounts={activeAccounts}
                    participantName={participantNameFor(
                      participantOptions,
                      claim.claimantParticipantId,
                    )}
                    onChanged={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ["group-claims", workspaceId],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["group-payables", workspaceId],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["group-report", workspaceId],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ["overview", workspaceId],
                      });
                    }}
                  />
                ))
              ) : (
                <Text style={{ color: colors.muted }}>No claims yet.</Text>
              )}
            </Card>
            <Card>
              <Header
                eyebrow="SPONSORED SPENDING"
                title="Record a sponsored expense"
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                This records a reimbursement expectation and does not post cash
                until a later reimbursement.
              </Text>
              <TextField
                label="Amount (VND minor units)"
                value={sponsoredAmount}
                onChangeText={setSponsoredAmount}
                keyboardType="number-pad"
                placeholder="250000"
              />
              <TextField
                label="Description"
                value={sponsoredDescription}
                onChangeText={setSponsoredDescription}
                placeholder="Paid venue deposit personally"
              />
              <PrimaryButton
                label={
                  createSponsored.isPending
                    ? "Recording…"
                    : "Record sponsored expense"
                }
                disabled={createSponsored.isPending}
                onPress={createSponsoredExpense}
              />
              {sponsoredQuery.data?.length ? (
                sponsoredQuery.data.map((expense) => (
                  <View key={expense.id} style={{ gap: 3 }}>
                    <Divider />
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ color: colors.ink, fontWeight: "700" }}>
                        {expense.description}
                      </Text>
                      <Money value={expense.amount} compact />
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {expense.status} · reimbursed{" "}
                      {formatMoneyText(expense.reimbursed)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.muted }}>
                  No sponsored expenses yet.
                </Text>
              )}
            </Card>
            <Card>
              <Header eyebrow="PAYABLES" title="Outstanding reimbursements" />
              {payablesQuery.isError ? (
                <InlineError message="Payables could not load." />
              ) : payablesQuery.data?.length ? (
                payablesQuery.data.map((payable) => (
                  <View key={payable.id} style={{ gap: 4 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ color: colors.ink, fontWeight: "700" }}>
                        {participantNameFor(
                          participantOptions,
                          payable.claimantParticipantId,
                        )}
                      </Text>
                      <Money value={payable.amount} compact />
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {payable.status} · paid {formatMoneyText(payable.paid)}
                    </Text>
                    <Divider />
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.muted }}>No payables yet.</Text>
              )}
            </Card>
            <Card>
              <Header eyebrow="TREASURY" title="Post direct expense" />
              <SelectField
                label="Account"
                value={accountId}
                onChange={setAccountId}
                options={activeAccounts}
              />
              <TextField
                label="Amount (VND minor units)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="250000"
              />
              <TextField
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Groceries"
              />
              <PrimaryButton
                label={postExpense.isPending ? "Posting…" : "Post expense"}
                disabled={postExpense.isPending}
                onPress={post}
              />
              {directExpensesQuery.isError ? (
                <InlineError message="Direct expenses could not load." />
              ) : directExpensesQuery.data?.length ? (
                directExpensesQuery.data.map((expense) => (
                  <View key={expense.id} style={{ gap: 3 }}>
                    <Divider />
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ color: colors.ink, fontWeight: "700" }}>
                        {expense.description}
                      </Text>
                      <Money value={expense.amount} compact />
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Posted {expense.createdAt.slice(0, 10)} · account{" "}
                      {expense.accountId.slice(0, 10)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.muted }}>
                  No direct expenses yet.
                </Text>
              )}
            </Card>
            {feedback ? <InlineError message={feedback} /> : null}
          </>
        )}
      </ScrollScreen>
    </AppShell>
  );
}

function CollectionRow({
  workspaceId,
  collection,
  api,
}: {
  workspaceId: string;
  collection: import("@finwise/api-client").GroupCollectionSummary;
  api: import("@finwise/api-client").FinwiseApiClient;
}) {
  const progressQuery = useQuery({
    queryKey: ["group-progress", workspaceId, collection.id],
    queryFn: () => api.getGroupCollectionProgress(workspaceId, collection.id),
  });
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.ink, fontWeight: "700" }}>
          {collection.name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {collection.status}
        </Text>
      </View>
      {progressQuery.isPending ? (
        <Text style={{ color: colors.muted }}>Loading progress…</Text>
      ) : progressQuery.isError ? (
        <>
          <InlineError message="Collection progress could not load." />
          <SecondaryButton
            label="Retry progress"
            onPress={() => void progressQuery.refetch()}
          />
        </>
      ) : progressQuery.data ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {progressQuery.data.completedParticipants}/
            {progressQuery.data.participantCount} complete
          </Text>
          <Money value={progressQuery.data.paid} compact />
        </View>
      ) : null}
      <Divider />
    </View>
  );
}
function SubmissionRow({
  workspaceId,
  submission,
  onChanged,
}: {
  workspaceId: string;
  submission: import("@finwise/api-client").GroupSubmissionSummary;
  onChanged: () => void;
}) {
  const { api } = useAuth();
  const verify = useMutation({
    mutationFn: () =>
      api.verifyGroupSubmission(workspaceId, submission.id, {
        effectiveDate: today(),
      }),
    onSuccess: onChanged,
    onError: (error: Error) => Alert.alert("Could not verify", error.message),
  });
  const resolve = useMutation({
    mutationFn: (resolution: "apply_credit" | "adjust_obligation" | "refund") =>
      api.resolveGroupOverpayment(workspaceId, submission.id, resolution),
    onSuccess: onChanged,
    onError: (error: Error) =>
      Alert.alert("Could not resolve overpayment", error.message),
  });
  return (
    <View style={{ gap: 5 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.ink, fontWeight: "700" }}>
          {submission.participantId.slice(0, 10)}
        </Text>
        <Money value={submission.amount} compact />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {submission.status}
        {submission.resolution ? ` · ${submission.resolution}` : ""}
      </Text>
      {submission.status === "submitted" ? (
        <PrimaryButton
          label={verify.isPending ? "Verifying…" : "Verify & post"}
          disabled={verify.isPending || resolve.isPending}
          onPress={() => verify.mutate()}
        />
      ) : null}
      {submission.status === "needs_user_action" ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.amber, fontSize: 12 }}>
            Overpayment requires an explicit resolution.
          </Text>
          {(["apply_credit", "adjust_obligation", "refund"] as const).map(
            (resolution) => (
              <SecondaryButton
                key={resolution}
                label={
                  resolve.isPending ? "Resolving…" : resolutionLabel(resolution)
                }
                disabled={resolve.isPending || verify.isPending}
                onPress={() => resolve.mutate(resolution)}
              />
            ),
          )}
        </View>
      ) : null}
      <Divider />
    </View>
  );
}

function ClaimRow({
  workspaceId,
  claim,
  api,
  accounts,
  participantName,
  onChanged,
}: {
  workspaceId: string;
  claim: import("@finwise/api-client").GroupClaimSummary;
  api: import("@finwise/api-client").FinwiseApiClient;
  accounts: readonly { label: string; value: string }[];
  participantName: string;
  onChanged: () => void;
}) {
  const [payerAccountId, setPayerAccountId] = useState("");
  const [reimbursementAmount, setReimbursementAmount] = useState(
    claim.amount.minorUnits,
  );
  const reimbursementCommandKey = useRef<StableCommandKeyState | undefined>(
    undefined,
  );
  const approve = useMutation({
    mutationFn: () => api.approveGroupClaim(workspaceId, claim.id),
    onSuccess: onChanged,
    onError: (error: Error) => Alert.alert("Could not approve", error.message),
  });
  const reimburse = useMutation({
    mutationFn: (command: {
      payerAccountId: string;
      amountMinorUnits: string;
      effectiveDate: string;
      idempotencyKey: string;
    }) =>
      api.reimburseGroupClaim(
        workspaceId,
        claim.id,
        {
          payerAccountId: command.payerAccountId,
          amountMinorUnits: command.amountMinorUnits,
          effectiveDate: command.effectiveDate,
        },
        command.idempotencyKey,
      ),
    onSuccess: () => {
      reimbursementCommandKey.current = undefined;
      onChanged();
    },
    onError: (error: Error) =>
      Alert.alert("Could not reimburse", error.message),
  });
  const canReimburse = claim.status === "approved";
  return (
    <View style={{ gap: 6 }}>
      <Divider />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.ink, fontWeight: "700" }}>
          {claim.description}
        </Text>
        <Money value={claim.amount} compact />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {participantName} · {claim.status} · paid {formatMoneyText(claim.paid)}
      </Text>
      {claim.status === "submitted" ? (
        <PrimaryButton
          label={approve.isPending ? "Approving…" : "Approve claim"}
          disabled={approve.isPending || reimburse.isPending}
          onPress={() => approve.mutate()}
        />
      ) : null}
      {canReimburse ? (
        <>
          <SelectField
            label="Payer account"
            value={payerAccountId}
            onChange={setPayerAccountId}
            options={accounts}
          />
          <TextField
            label="Reimbursement amount (VND minor units)"
            value={reimbursementAmount}
            onChangeText={setReimbursementAmount}
            keyboardType="number-pad"
          />
          <SecondaryButton
            label={reimburse.isPending ? "Paying…" : "Reimburse"}
            disabled={
              reimburse.isPending ||
              approve.isPending ||
              !payerAccountId ||
              !/^\d+$/.test(reimbursementAmount.trim()) ||
              BigInt(reimbursementAmount.trim() || "0") <= 0n
            }
            onPress={() => {
              const commandInput = {
                payerAccountId,
                amountMinorUnits: reimbursementAmount.trim(),
                effectiveDate: today(),
              };
              const commandKey = stableCommandKey(
                reimbursementCommandKey.current,
                `mobile-group-reimburse-${claim.id}`,
                commandInput,
              );
              reimbursementCommandKey.current = commandKey.state;
              reimburse.mutate({
                ...commandInput,
                idempotencyKey: commandKey.key,
              });
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function participantNameFor(
  options: readonly { label: string; value: string }[],
  participantId: string,
): string {
  return (
    options.find((option) => option.value === participantId)?.label ??
    participantId.slice(0, 10)
  );
}

function formatMoneyText(
  value: import("@finwise/api-client").MoneyDto,
): string {
  return `${formatVnd(value.minorUnits)} ₫`;
}

function resolutionLabel(
  resolution: "apply_credit" | "adjust_obligation" | "refund",
): string {
  return {
    apply_credit: "Apply as participant credit",
    adjust_obligation: "Increase obligation",
    refund: "Refund the overpayment",
  }[resolution];
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: import("@finwise/api-client").MoneyDto;
}) {
  return (
    <Card style={{ flex: 1 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Money value={value} compact />
    </Card>
  );
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
