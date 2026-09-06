import { AuthenticatedActor } from '../../shared/application/auth';
import {
  AccountKind,
  AccountRecord,
  AccountVisibilityMode,
  RoleRecord,
  UserRecord,
  JournalKind,
  JournalTransactionRecord,
  TransactionAuditRecord,
  JournalSourceLinkRecord,
  WorkspaceKind,
  WorkspaceRecord,
  WorkspaceMemberRecord,
  WorkspaceInvitationRecord,
  OwnerTransferRecord,
  BudgetRecord,
  TagRecord,
  ClassificationLineRecord,
  BudgetConstraintMode,
  BudgetRolloverMode,
  BudgetPeriodRecord,
  BudgetConstraintRecord,
} from '../domain/ledger.types';

export interface BootstrapResult {
  readonly user: UserRecord;
  readonly workspaces: readonly WorkspaceRecord[];
  readonly suggestedWorkspaceId: string;
}

export interface InvitationCommandResult {
  readonly invitation: WorkspaceInvitationRecord;
}

export interface CoreMembershipPort {
  createInvitation(
    workspaceId: string,
    actor: AuthenticatedActor,
    invitedUserId: string,
    roleId?: string,
  ): WorkspaceInvitationRecord;
  listInvitations(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly WorkspaceInvitationRecord[];
  acceptInvitation(
    token: string,
    actor: AuthenticatedActor,
  ): WorkspaceMemberRecord;
  revokeInvitation(
    workspaceId: string,
    actor: AuthenticatedActor,
    invitationId: string,
  ): WorkspaceInvitationRecord;
  removeMember(
    workspaceId: string,
    actor: AuthenticatedActor,
    memberId: string,
  ): WorkspaceMemberRecord;
  initiateOwnerTransfer(
    workspaceId: string,
    actor: AuthenticatedActor,
    targetMemberId: string,
  ): OwnerTransferRecord;
  acceptOwnerTransfer(
    transferId: string,
    actor: AuthenticatedActor,
  ): OwnerTransferRecord;
  cancelOwnerTransfer(
    workspaceId: string,
    actor: AuthenticatedActor,
    transferId: string,
  ): OwnerTransferRecord;
  archiveWorkspace(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): WorkspaceRecord;
}

export interface JournalDraft {
  readonly workspaceId: string;
  readonly kind: JournalKind;
  readonly amountMinorUnits: bigint;
  readonly effectiveDate: string;
  readonly description?: string;
  readonly createdByMemberId: string;
  readonly entries: readonly {
    readonly accountId: string;
    readonly amountMinorUnits: bigint;
    readonly direction: 'increase' | 'decrease';
  }[];
  readonly reversalOfId?: string;
}

export interface ClassificationLineDraft {
  readonly budgetId: string;
  readonly amountMinorUnits: bigint;
  readonly tagIds: readonly string[];
}

export interface BudgetConstraintDraft {
  readonly budgetId: string;
  readonly mode: BudgetConstraintMode;
  readonly fixedMinorUnits: bigint;
  readonly percentageBasisPoints: number;
  readonly rolloverMode: BudgetRolloverMode;
}

export interface BudgetConstraintProjection {
  readonly constraint: BudgetConstraintRecord;
  readonly allocatedMinorUnits: bigint;
  readonly actualMinorUnits: bigint;
  readonly remainingMinorUnits: bigint;
}

export interface BudgetOverviewProjection {
  readonly period: BudgetPeriodRecord;
  readonly constraints: readonly BudgetConstraintProjection[];
  readonly totalAllocatedMinorUnits: bigint;
  readonly totalActualMinorUnits: bigint;
  readonly totalRemainingMinorUnits: bigint;
}

export interface CoreStorePort extends CoreMembershipPort {
  bootstrap(actor: AuthenticatedActor): BootstrapResult;
  createWorkspace(
    actor: AuthenticatedActor,
    name: string,
    kind: WorkspaceKind,
  ): WorkspaceRecord;
  getWorkspace(workspaceId: string, actor: AuthenticatedActor): WorkspaceRecord;
  listMembers(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly WorkspaceMemberRecord[];
  listRoles(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly RoleRecord[];
  createRole(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
    permissions: readonly string[],
  ): RoleRecord;
  updateRole(
    workspaceId: string,
    actor: AuthenticatedActor,
    roleId: string,
    name: string,
    permissions: readonly string[],
  ): RoleRecord;
  deleteRole(
    workspaceId: string,
    actor: AuthenticatedActor,
    roleId: string,
  ): void;
  assignRole(
    workspaceId: string,
    actor: AuthenticatedActor,
    memberId: string,
    roleId: string,
  ): WorkspaceMemberRecord;
  updateAccountAccess(
    workspaceId: string,
    actor: AuthenticatedActor,
    accountId: string,
    visibilityMode: AccountVisibilityMode,
    memberId?: string,
    allowed?: boolean,
  ): AccountRecord;
  listAccounts(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly AccountRecord[];
  hasPartialAccountAccess(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): boolean;
  createAccount(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
    kind: AccountKind,
    visibilityMode: AccountVisibilityMode,
  ): AccountRecord;
  getAccount(
    workspaceId: string,
    accountId: string,
    actor: AuthenticatedActor,
  ): AccountRecord;
  archiveAccount(
    workspaceId: string,
    accountId: string,
    actor: AuthenticatedActor,
  ): AccountRecord;
  memberIdFor(workspaceId: string, userId: string): string;
  systemAccount(workspaceId: string, purpose: string): AccountRecord;
  postJournal(draft: JournalDraft): JournalTransactionRecord;
  postJournalWithClassification(
    draft: JournalDraft,
    lines: readonly ClassificationLineDraft[],
  ): JournalTransactionRecord;
  listTransactions(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly JournalTransactionRecord[];
  assertReportAccess(workspaceId: string, actor: AuthenticatedActor): void;
  getTransaction(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
  ): JournalTransactionRecord;
  voidTransaction(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
    reason: string,
    effectiveDate: string,
  ): {
    readonly original: JournalTransactionRecord;
    readonly reversal: JournalTransactionRecord;
  };
  replaceTransaction(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
    replacement: JournalDraft,
    reason: string,
    effectiveDate: string,
  ): {
    readonly original: JournalTransactionRecord;
    readonly reversal: JournalTransactionRecord;
    readonly replacement: JournalTransactionRecord;
  };
  rebuildBalances(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly {
    readonly accountId: string;
    readonly balanceMinorUnits: bigint;
  }[];
  createBudget(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
    parentId?: string,
  ): BudgetRecord;
  listBudgets(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly BudgetRecord[];
  archiveBudget(
    workspaceId: string,
    actor: AuthenticatedActor,
    budgetId: string,
  ): BudgetRecord;
  createTag(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
  ): TagRecord;
  listTags(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly TagRecord[];
  classifyTransaction(
    workspaceId: string,
    actor: AuthenticatedActor,
    transactionId: string,
    lines: readonly ClassificationLineDraft[],
  ): readonly ClassificationLineRecord[];
  getClassification(
    workspaceId: string,
    actor: AuthenticatedActor,
    transactionId: string,
  ): readonly ClassificationLineRecord[];
  createBudgetPeriod(
    workspaceId: string,
    actor: AuthenticatedActor,
    month: string,
    baseMinorUnits: bigint,
    constraints: readonly BudgetConstraintDraft[],
  ): BudgetPeriodRecord;
  listBudgetPeriods(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly BudgetPeriodRecord[];
  getBudgetOverview(
    workspaceId: string,
    actor: AuthenticatedActor,
    month: string,
  ): BudgetOverviewProjection;
  closeBudgetPeriod(
    workspaceId: string,
    actor: AuthenticatedActor,
    month: string,
  ): BudgetPeriodRecord;
  getIdempotency<T extends object>(
    workspaceId: string,
    key: string,
    operation: string,
    requestHash: string,
  ): T | undefined;
  saveIdempotency(
    workspaceId: string,
    key: string,
    operation: string,
    requestHash: string,
    response: object,
  ): void;
  hashRequest(value: string): string;
  getAudits(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
  ): readonly TransactionAuditRecord[];
  linkJournalSource(
    workspaceId: string,
    transactionId: string,
    sourceType: JournalSourceLinkRecord['sourceType'],
    sourceId: string,
    actor: AuthenticatedActor,
  ): JournalSourceLinkRecord;
  getJournalSourceLinks(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
  ): readonly JournalSourceLinkRecord[];
}
