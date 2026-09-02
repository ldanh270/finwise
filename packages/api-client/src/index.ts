/**
 * Platform-neutral Finwise transport boundary.
 *
 * The Nest `/v1` API is the source of truth. This package intentionally keeps
 * transport DTOs and request orchestration only; auth/session policy and UI
 * state live in each client application.
 */

export type MoneyDto = {
  readonly currency: "VND";
  readonly minorUnits: string;
};
export type ErrorEnvelope = {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
  readonly requestId?: string;
};
export type UserProfile = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
};
export type WorkspaceSummary = {
  readonly id: string;
  readonly name: string;
  readonly intent: "PERSONAL" | "SHARED";
  readonly kind?: string;
  readonly currency?: "VND";
  readonly status?: string;
};
export type WorkspaceMemberSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly status: string;
  readonly isOwner: boolean;
  readonly roleIds: readonly string[];
};
export type BootstrapResponse = {
  readonly user: UserProfile;
  readonly workspaces: readonly WorkspaceSummary[];
  readonly suggestedWorkspaceId: string | null;
  readonly requestId?: string;
};
export type AuthSessionResponse = {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshToken?: string;
  readonly user: UserProfile;
};
export type AccountSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly kind: "cash" | "bank" | "savings" | "other";
  readonly currency: "VND";
  readonly balanceMinorUnits: string;
  readonly visibilityMode: string;
  readonly status: "active" | "archived";
};
export type BalanceViewSummary = {
  readonly accountId: string;
  readonly ledger: MoneyDto;
  readonly cleared: MoneyDto;
  readonly reconciled: MoneyDto;
};
export type JournalEntrySummary = {
  readonly id: string;
  readonly accountId: string;
  readonly amountMinorUnits: string;
  readonly direction: "increase" | "decrease";
};
export type ClassificationLineSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly transactionId: string;
  readonly categoryId: string;
  readonly amount: MoneyDto;
  readonly tagIds: readonly string[];
};
export type TransactionAuditSummary = {
  readonly id: string;
  readonly action: "created" | "voided" | "replaced" | string;
  readonly actorMemberId: string;
  readonly details?: Readonly<Record<string, string>>;
  readonly createdAt: string;
};
export type JournalSourceLinkSummary = {
  readonly id: string;
  readonly transactionId: string;
  readonly sourceType:
    "import_record" | "group_submission" | "reconciliation" | string;
  readonly sourceId: string;
  readonly createdAt: string;
};
export type TransactionSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind:
    "opening_balance" | "income" | "expense" | "transfer" | "adjustment";
  readonly status: "posted" | "voided";
  readonly amount: MoneyDto;
  readonly effectiveDate: string;
  readonly recordedAt: string;
  readonly description?: string;
  readonly reversalOfId?: string;
  readonly entries?: readonly JournalEntrySummary[];
};
export type OverviewResponse = {
  readonly workspaceId: string;
  readonly period: string;
  readonly accounts: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: "CASH" | "BANK" | "SAVINGS" | "OTHER";
    readonly balance: MoneyDto;
    readonly isArchived: boolean;
  }[];
  readonly recentTransactions: readonly {
    readonly id: string;
    readonly date: string;
    readonly description: string;
    readonly type: "INCOME" | "EXPENSE" | "TRANSFER";
    readonly status: "posted" | "voided";
    readonly amount: MoneyDto;
    readonly accountName: string;
    readonly categoryName: string | null;
  }[];
  readonly budgets: readonly unknown[];
  readonly totals: {
    readonly accountBalance: MoneyDto;
    readonly budgetRemaining: MoneyDto;
    readonly income: MoneyDto;
    readonly spending: MoneyDto;
  };
  readonly hasPartialAccess: boolean;
};
export type CategorySummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly parentId?: string;
  readonly status: string;
};
export type TagSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly status: string;
};
export type BudgetPeriodSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly month: string;
  readonly base: MoneyDto;
  readonly carry: MoneyDto;
  readonly status: string;
};
export type BudgetConstraintSummary = {
  readonly categoryId: string;
  readonly mode: string;
  readonly fixed: MoneyDto;
  readonly percentageBasisPoints: number;
  readonly rolloverMode: string;
  readonly allocated: MoneyDto;
  readonly actual: MoneyDto;
  readonly remaining: MoneyDto;
};
export type BudgetOverviewSummary = BudgetPeriodSummary & {
  readonly constraints: readonly BudgetConstraintSummary[];
  readonly totals: {
    readonly allocated: MoneyDto;
    readonly actual: MoneyDto;
    readonly remaining: MoneyDto;
  };
};
export type GroupCollectionSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly createdByMemberId: string;
  readonly status: string;
};
export type GroupCollectionProgress = {
  readonly collectionId: string;
  readonly total: MoneyDto;
  readonly paid: MoneyDto;
  readonly outstanding: MoneyDto;
  readonly participantCount: number;
  readonly completedParticipants: number;
};
export type GroupParticipantSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly memberId: string;
  readonly displayName: string;
  readonly status: string;
};
export type GroupObligationSummary = {
  readonly id: string;
  readonly collectionId: string;
  readonly participantId: string;
  readonly amount: MoneyDto;
  readonly paid: MoneyDto;
};
export type GroupSubmissionSummary = {
  readonly id: string;
  readonly collectionId: string;
  readonly participantId: string;
  readonly amount: MoneyDto;
  readonly accountId: string;
  readonly status: string;
  readonly resolution?: "apply_credit" | "adjust_obligation" | "refund";
  readonly journalTransactionId?: string;
};
export type GroupSponsoredExpenseSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly sponsorMemberId: string;
  readonly amount: MoneyDto;
  readonly description: string;
  readonly status: string;
  readonly reimbursed: MoneyDto;
};
export type GroupClaimSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly claimantParticipantId: string;
  readonly accountId: string;
  readonly amount: MoneyDto;
  readonly description: string;
  readonly status: string;
  readonly paid: MoneyDto;
  readonly payableId?: string;
};
export type GroupPayableSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly claimantParticipantId: string;
  readonly claimId: string;
  readonly amount: MoneyDto;
  readonly paid: MoneyDto;
  readonly status: string;
};
export type GroupReimbursementSummary = {
  readonly id: string;
  readonly payableId: string;
  readonly accountId: string;
  readonly amount: MoneyDto;
  readonly journalTransactionId: string;
};
export type GroupDirectExpenseSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly amount: MoneyDto;
  readonly description: string;
  readonly journalTransactionId: string;
  readonly createdByMemberId: string;
  readonly createdAt: string;
};
export type GroupReportSummary = {
  readonly collectionExpected: MoneyDto;
  readonly collectionReceived: MoneyDto;
  readonly collectionOutstanding: MoneyDto;
  readonly directExpense: MoneyDto;
  readonly approvedClaimExpense: MoneyDto;
  readonly sponsoredValue: MoneyDto;
  readonly openPayable: MoneyDto;
  readonly pendingSubmissionCount: number;
  readonly pendingSubmissionAmount: MoneyDto;
};
export type ImportSessionSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly fileName: string;
  readonly fileHash: string;
  readonly rawSizeBytes: number;
  readonly rawDeletedAt?: string;
  readonly status: string;
  readonly createdAt: string;
};
export type ImportedRecordSummary = {
  readonly id: string;
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly effectiveDate: string;
  readonly amount: MoneyDto;
  readonly type: string;
  readonly description: string;
  readonly sourceKey: string;
  readonly status: string;
  readonly matchedTransactionId?: string;
  readonly confirmedTransactionId?: string;
  readonly decisionReason?: string;
};
export type ReconciliationSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly statementDate: string;
  readonly externalBalance: MoneyDto;
  readonly ledgerBalance: MoneyDto;
  readonly difference: MoneyDto;
  readonly status: string;
  readonly adjustmentTransactionId?: string;
};

export type FinwiseApiClientOptions = {
  readonly baseUrl: string;
  readonly getAccessToken?: () => Promise<string | undefined>;
  readonly getRefreshToken?: () => Promise<string | undefined>;
  readonly getRequestId?: () => string | undefined;
  readonly fetchImpl?: typeof fetch;
  readonly clientType?: "web" | "mobile";
  readonly refreshAccessToken?: () => Promise<boolean>;
};

export class FinwiseApiError extends Error {
  constructor(
    readonly status: number,
    readonly envelope: ErrorEnvelope,
  ) {
    super(envelope.message);
    this.name = "FinwiseApiError";
  }
}

export class FinwiseApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: FinwiseApiClientOptions["getAccessToken"];
  private readonly getRefreshToken?: FinwiseApiClientOptions["getRefreshToken"];
  private readonly getRequestId?: FinwiseApiClientOptions["getRequestId"];
  private readonly fetchImpl: typeof fetch;
  private readonly clientType: "web" | "mobile";
  private readonly refreshAccessToken?: FinwiseApiClientOptions["refreshAccessToken"];
  private readonly workspaceRequests = new Map<string, Set<AbortController>>();

  constructor(options: FinwiseApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken;
    this.getRefreshToken = options.getRefreshToken;
    this.getRequestId = options.getRequestId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.clientType = options.clientType ?? "web";
    this.refreshAccessToken = options.refreshAccessToken;
  }

  /** Abort transport requests currently reading or writing one workspace. */
  cancelWorkspaceRequests(workspaceId: string): void {
    const controllers = this.workspaceRequests.get(workspaceId);
    if (!controllers) return;
    for (const controller of controllers) controller.abort();
    this.workspaceRequests.delete(workspaceId);
  }

  register(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthSessionResponse> {
    return this.post("/v1/auth/register", input);
  }
  login(input: {
    email: string;
    password: string;
  }): Promise<AuthSessionResponse> {
    return this.post("/v1/auth/login", input);
  }
  async refresh(): Promise<AuthSessionResponse> {
    return this.post("/v1/auth/refresh", undefined, undefined, {
      "X-Finwise-Refresh-Token": await this.getRefreshToken?.(),
    });
  }
  async logout(): Promise<void> {
    await this.post<void>("/v1/auth/logout", undefined, undefined, {
      "X-Finwise-Refresh-Token": await this.getRefreshToken?.(),
    });
  }
  getBootstrap(): Promise<BootstrapResponse> {
    return this.get("/v1/session/bootstrap");
  }
  getOverview(workspaceId: string): Promise<OverviewResponse> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/overview`);
  }
  getWorkspaceMembers(
    workspaceId: string,
  ): Promise<readonly WorkspaceMemberSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/members`);
  }
  getAccounts(workspaceId: string): Promise<readonly AccountSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/accounts`);
  }
  getTransactions(workspaceId: string): Promise<readonly TransactionSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/transactions`);
  }
  getTransaction(
    workspaceId: string,
    transactionId: string,
  ): Promise<TransactionSummary> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/transactions/${segment(transactionId)}`,
    );
  }
  getTransactionClassification(
    workspaceId: string,
    transactionId: string,
  ): Promise<readonly ClassificationLineSummary[]> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/transactions/${segment(transactionId)}/classification`,
    );
  }
  classifyTransaction(
    workspaceId: string,
    transactionId: string,
    input: {
      readonly lines: readonly {
        readonly categoryId: string;
        readonly amountMinorUnits: string;
        readonly tagIds?: readonly string[];
      }[];
    },
  ): Promise<readonly ClassificationLineSummary[]> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/transactions/${segment(transactionId)}/classification`,
      input,
    );
  }
  replaceTransaction(
    workspaceId: string,
    transactionId: string,
    input: {
      readonly reason: string;
      readonly type: "income" | "expense" | "transfer";
      readonly amountMinorUnits: string;
      readonly accountId: string;
      readonly destinationAccountId?: string;
      readonly effectiveDate: string;
      readonly description?: string;
    },
    idempotencyKey: string,
  ): Promise<{
    readonly original: TransactionSummary;
    readonly reversal: TransactionSummary;
    readonly replacement: TransactionSummary;
  }> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/transactions/${segment(transactionId)}/replace`,
      input,
      idempotencyKey,
    );
  }
  getTransactionAudits(
    workspaceId: string,
    transactionId: string,
  ): Promise<readonly TransactionAuditSummary[]> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/transactions/${segment(transactionId)}/audits`,
    );
  }
  getTransactionSourceLinks(
    workspaceId: string,
    transactionId: string,
  ): Promise<readonly JournalSourceLinkSummary[]> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/transactions/${segment(transactionId)}/source-links`,
    );
  }
  getBalanceViews(workspaceId: string): Promise<readonly BalanceViewSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/balances`);
  }
  getCategories(workspaceId: string): Promise<readonly CategorySummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/categories`);
  }
  createCategory(
    workspaceId: string,
    input: { name: string; parentId?: string },
  ): Promise<CategorySummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/categories`,
      input,
    );
  }
  getTags(workspaceId: string): Promise<readonly TagSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/tags`);
  }
  createTag(workspaceId: string, input: { name: string }): Promise<TagSummary> {
    return this.post(`/v1/workspaces/${segment(workspaceId)}/tags`, input);
  }
  getBudgetPeriods(
    workspaceId: string,
  ): Promise<readonly BudgetPeriodSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/budgets`);
  }
  getBudgetOverview(
    workspaceId: string,
    month: string,
  ): Promise<BudgetOverviewSummary> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/budgets/${segment(month)}`,
    );
  }
  createBudgetPeriod(
    workspaceId: string,
    input: {
      month: string;
      baseMinorUnits: string;
      constraints: readonly {
        categoryId: string;
        mode: "BY_CHILDREN" | "SHARED_POOL" | "HYBRID";
        fixedMinorUnits: string;
        percentageBasisPoints?: number;
        rolloverMode?: "NONE" | "POSITIVE_ONLY" | "FULL_BALANCE";
      }[];
    },
  ): Promise<BudgetPeriodSummary> {
    return this.post(`/v1/workspaces/${segment(workspaceId)}/budgets`, input);
  }
  closeBudgetPeriod(
    workspaceId: string,
    month: string,
  ): Promise<BudgetPeriodSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/budgets/${segment(month)}/close`,
      undefined,
    );
  }
  createAccount(
    workspaceId: string,
    input: {
      name: string;
      kind: AccountSummary["kind"];
      visibilityMode?: string;
    },
  ): Promise<AccountSummary> {
    return this.post(`/v1/workspaces/${segment(workspaceId)}/accounts`, input);
  }
  postOpeningBalance(
    workspaceId: string,
    accountId: string,
    input: {
      amountMinorUnits: string;
      effectiveDate: string;
      description?: string;
    },
    idempotencyKey: string,
  ): Promise<TransactionSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/accounts/${segment(accountId)}/opening-balance`,
      input,
      idempotencyKey,
    );
  }
  createTransaction(
    workspaceId: string,
    input: {
      type: "income" | "expense" | "transfer";
      amountMinorUnits: string;
      accountId: string;
      destinationAccountId?: string;
      effectiveDate: string;
      description?: string;
    },
    idempotencyKey: string,
  ): Promise<TransactionSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/transactions`,
      input,
      idempotencyKey,
    );
  }
  voidTransaction(
    workspaceId: string,
    transactionId: string,
    input: { reason: string; effectiveDate: string },
    idempotencyKey: string,
  ): Promise<{
    readonly original: TransactionSummary;
    readonly reversal: TransactionSummary;
  }> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/transactions/${segment(transactionId)}/void`,
      input,
      idempotencyKey,
    );
  }
  exportTransactions(workspaceId: string): Promise<string> {
    return this.getText(
      `/v1/workspaces/${segment(workspaceId)}/transactions/export`,
    );
  }
  getGroupCollections(
    workspaceId: string,
  ): Promise<readonly GroupCollectionSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/group/collections`);
  }
  createGroupCollection(
    workspaceId: string,
    input: { name: string },
  ): Promise<GroupCollectionSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/collections`,
      input,
    );
  }
  getGroupParticipants(
    workspaceId: string,
  ): Promise<readonly GroupParticipantSummary[]> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/group/participants`,
    );
  }
  createGroupParticipant(
    workspaceId: string,
    input: { memberId: string; displayName: string },
  ): Promise<GroupParticipantSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/participants`,
      input,
    );
  }
  getGroupCollectionProgress(
    workspaceId: string,
    collectionId: string,
  ): Promise<GroupCollectionProgress> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/group/collections/${segment(collectionId)}/progress`,
    );
  }
  getGroupObligations(
    workspaceId: string,
    collectionId: string,
  ): Promise<readonly GroupObligationSummary[]> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/group/collections/${segment(collectionId)}/obligations`,
    );
  }
  addGroupObligation(
    workspaceId: string,
    collectionId: string,
    input: { participantId: string; amountMinorUnits: string },
  ): Promise<GroupObligationSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/collections/${segment(collectionId)}/obligations`,
      input,
    );
  }
  getGroupSubmissions(
    workspaceId: string,
    collectionId: string,
  ): Promise<readonly GroupSubmissionSummary[]> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/group/collections/${segment(collectionId)}/submissions`,
    );
  }
  createGroupSubmission(
    workspaceId: string,
    collectionId: string,
    input: {
      participantId: string;
      accountId: string;
      amountMinorUnits: string;
    },
  ): Promise<GroupSubmissionSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/collections/${segment(collectionId)}/submissions`,
      input,
    );
  }
  verifyGroupSubmission(
    workspaceId: string,
    submissionId: string,
    input?: {
      effectiveDate?: string;
      allocations?: readonly {
        participantId: string;
        amountMinorUnits: string;
      }[];
    },
  ): Promise<GroupSubmissionSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/submissions/${segment(submissionId)}/verify`,
      input ?? {},
    );
  }
  resolveGroupOverpayment(
    workspaceId: string,
    submissionId: string,
    resolution: "apply_credit" | "adjust_obligation" | "refund",
  ): Promise<GroupSubmissionSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/submissions/${segment(submissionId)}/resolve-overpayment`,
      { resolution },
    );
  }
  getGroupSponsoredExpenses(
    workspaceId: string,
  ): Promise<readonly GroupSponsoredExpenseSummary[]> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/group/sponsored-expenses`,
    );
  }
  createGroupSponsoredExpense(
    workspaceId: string,
    input: { amountMinorUnits: string; description: string },
  ): Promise<GroupSponsoredExpenseSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/sponsored-expenses`,
      input,
    );
  }
  getGroupReportSummary(workspaceId: string): Promise<GroupReportSummary> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/group/reports/summary`,
    );
  }
  getGroupClaims(workspaceId: string): Promise<readonly GroupClaimSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/group/claims`);
  }
  createGroupClaim(
    workspaceId: string,
    input: {
      claimantParticipantId: string;
      accountId: string;
      amountMinorUnits: string;
      description: string;
    },
  ): Promise<GroupClaimSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/claims`,
      input,
    );
  }
  approveGroupClaim(
    workspaceId: string,
    claimId: string,
  ): Promise<GroupClaimSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/claims/${segment(claimId)}/approve`,
      undefined,
    );
  }
  reimburseGroupClaim(
    workspaceId: string,
    claimId: string,
    input: {
      payerAccountId: string;
      amountMinorUnits: string;
      effectiveDate?: string;
    },
    idempotencyKey: string,
  ): Promise<{
    readonly claim: GroupClaimSummary;
    readonly payable: GroupPayableSummary;
    readonly reimbursement: GroupReimbursementSummary;
  }> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/claims/${segment(claimId)}/reimburse`,
      input,
      idempotencyKey,
    );
  }
  createDirectGroupExpense(
    workspaceId: string,
    input: {
      accountId: string;
      amountMinorUnits: string;
      description: string;
      effectiveDate: string;
    },
    idempotencyKey: string,
  ): Promise<GroupDirectExpenseSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/group/expenses`,
      input,
      idempotencyKey,
    );
  }
  getGroupPayables(
    workspaceId: string,
  ): Promise<readonly GroupPayableSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/group/payables`);
  }
  getGroupDirectExpenses(
    workspaceId: string,
  ): Promise<readonly GroupDirectExpenseSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/group/expenses`);
  }
  getImportSessions(
    workspaceId: string,
  ): Promise<readonly ImportSessionSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/imports`);
  }
  getImportedRecords(
    workspaceId: string,
    sessionId: string,
  ): Promise<readonly ImportedRecordSummary[]> {
    return this.get(
      `/v1/workspaces/${segment(workspaceId)}/imports/${segment(sessionId)}/records`,
    );
  }
  createImportSession(
    workspaceId: string,
    input: { accountId: string; fileName: string; csvContent: string },
  ): Promise<ImportSessionSummary & { readonly duplicate: boolean }> {
    return this.post(`/v1/workspaces/${segment(workspaceId)}/imports`, input);
  }
  confirmImportedRecord(
    workspaceId: string,
    recordId: string,
    idempotencyKey: string,
  ): Promise<ImportedRecordSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/imports/records/${segment(recordId)}/confirm`,
      undefined,
      idempotencyKey,
    );
  }
  matchImportedRecord(
    workspaceId: string,
    recordId: string,
    transactionId: string,
  ): Promise<ImportedRecordSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/imports/records/${segment(recordId)}/match`,
      { transactionId },
    );
  }
  decideImportedRecord(
    workspaceId: string,
    recordId: string,
    decision: "ignore" | "needs-attention",
    reason: string,
  ): Promise<ImportedRecordSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/imports/records/${segment(recordId)}/${decision}`,
      { reason },
    );
  }
  deleteImportRaw(
    workspaceId: string,
    sessionId: string,
  ): Promise<ImportSessionSummary> {
    return this.delete(
      `/v1/workspaces/${segment(workspaceId)}/imports/${segment(sessionId)}/raw`,
    );
  }
  getReconciliations(
    workspaceId: string,
  ): Promise<readonly ReconciliationSummary[]> {
    return this.get(`/v1/workspaces/${segment(workspaceId)}/reconciliations`);
  }
  startReconciliation(
    workspaceId: string,
    input: {
      accountId: string;
      statementDate: string;
      externalBalanceMinorUnits: string;
    },
  ): Promise<ReconciliationSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/reconciliations`,
      input,
    );
  }
  adjustReconciliation(
    workspaceId: string,
    checkpointId: string,
    input: {
      amountMinorUnits: string;
      reason: string;
      effectiveDate: string;
    },
  ): Promise<ReconciliationSummary> {
    return this.post(
      `/v1/workspaces/${segment(workspaceId)}/reconciliations/${segment(checkpointId)}/adjust`,
      input,
    );
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }
  async post<T = never>(
    path: string,
    body?: unknown,
    idempotencyKey?: string,
    extraHeaders?: Record<string, string | undefined>,
  ): Promise<T> {
    return this.request<T>("POST", path, body, idempotencyKey, extraHeaders);
  }
  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
  async getText(path: string): Promise<string> {
    const requestScope = this.trackWorkspaceRequest(path);
    const requestId = this.requestId();
    try {
      let response = await this.fetchResponse(
        "GET",
        path,
        "text/csv",
        undefined,
        undefined,
        {
          "X-Request-Id": requestId,
        },
        requestScope?.signal,
      );
      let payload = await response.text();
      if (
        response.status === 401 &&
        this.refreshAccessToken &&
        !path.startsWith("/v1/auth/")
      ) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          response = await this.fetchResponse(
            "GET",
            path,
            "text/csv",
            undefined,
            undefined,
            {
              "X-Request-Id": requestId,
            },
            requestScope?.signal,
          );
          payload = await response.text();
        }
      }
      if (!response.ok)
        throw new FinwiseApiError(response.status, errorEnvelope(payload));
      return payload;
    } finally {
      requestScope?.dispose();
    }
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    idempotencyKey?: string,
    extraHeaders?: Record<string, string | undefined>,
  ): Promise<T> {
    const requestScope = this.trackWorkspaceRequest(path);
    const requestId = this.requestId();
    const requestHeaders = {
      ...(extraHeaders ?? {}),
      "X-Request-Id": requestId,
    };
    try {
      let response = await this.fetchResponse(
        method,
        path,
        "application/json",
        body,
        idempotencyKey,
        requestHeaders,
        requestScope?.signal,
      );
      let payload: unknown = await response.json().catch(() => undefined);
      if (
        response.status === 401 &&
        this.refreshAccessToken &&
        !path.startsWith("/v1/auth/")
      ) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          response = await this.fetchResponse(
            method,
            path,
            "application/json",
            body,
            idempotencyKey,
            requestHeaders,
            requestScope?.signal,
          );
          payload = await response.json().catch(() => undefined);
        }
      }
      if (!response.ok)
        throw new FinwiseApiError(
          response.status,
          isErrorEnvelope(payload)
            ? payload
            : { code: "UNKNOWN_ERROR", message: "Finwise request failed." },
        );
      return payload as T;
    } finally {
      requestScope?.dispose();
    }
  }

  private async fetchResponse(
    method: "GET" | "POST" | "DELETE",
    path: string,
    accept: string,
    body?: unknown,
    idempotencyKey?: string,
    extraHeaders?: Record<string, string | undefined>,
    signal?: AbortSignal,
  ): Promise<Response> {
    const token = await this.getAccessToken?.();
    const headers: Record<string, string> = {
      Accept: accept,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(this.clientType === "mobile" ? { "X-Finwise-Client": "mobile" } : {}),
    };
    for (const [key, value] of Object.entries(extraHeaders ?? {}))
      if (value) headers[key] = value;
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  }

  private trackWorkspaceRequest(path: string): WorkspaceRequestScope | null {
    const workspaceId = workspaceIdFromPath(path);
    if (!workspaceId) return null;
    const controller = new AbortController();
    const requests = this.workspaceRequests.get(workspaceId) ?? new Set();
    requests.add(controller);
    this.workspaceRequests.set(workspaceId, requests);
    return {
      signal: controller.signal,
      dispose: () => {
        const current = this.workspaceRequests.get(workspaceId);
        if (!current) return;
        current.delete(controller);
        if (current.size === 0) this.workspaceRequests.delete(workspaceId);
      },
    };
  }

  private requestId(): string {
    const supplied = this.getRequestId?.()?.trim();
    return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
      ? supplied
      : `finwise-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

type WorkspaceRequestScope = {
  readonly signal: AbortSignal;
  readonly dispose: () => void;
};

function workspaceIdFromPath(path: string): string | null {
  const match = /^\/v1\/workspaces\/([^/]+)(?:\/|$)/.exec(path);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function segment(value: string): string {
  return encodeURIComponent(value);
}
function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}
function errorEnvelope(payload: string): ErrorEnvelope {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (isErrorEnvelope(parsed)) return parsed;
  } catch {
    /* untyped bodies stay private */
  }
  return { code: "UNKNOWN_ERROR", message: "Finwise request failed." };
}
