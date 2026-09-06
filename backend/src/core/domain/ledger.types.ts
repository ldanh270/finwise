import type { CurrencyCode } from './currency';

export type WorkspaceKind = 'personal' | 'family' | 'class_fund' | 'other';
export type WorkspaceStatus = 'active' | 'archived';
export type MembershipStatus = 'invited' | 'active' | 'removed';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type OwnerTransferStatus =
  'pending' | 'accepted' | 'cancelled' | 'expired';
export type AccountKind =
  | 'cash'
  | 'bank'
  | 'savings'
  | 'investment_cash'
  | 'loan_receivable'
  | 'liability'
  | 'system';
export type AccountStatus = 'active' | 'archived';
export type BudgetStatus = 'active' | 'archived';
export type BudgetPeriodStatus = 'open' | 'closed';
export type BudgetConstraintMode = 'BY_CHILDREN' | 'SHARED_POOL' | 'HYBRID';
export type BudgetRolloverMode = 'NONE' | 'POSITIVE_ONLY' | 'FULL_BALANCE';
export type AccountVisibilityMode =
  'workspace_default' | 'exclude_selected' | 'include_only' | 'owner_only';
export type JournalKind =
  'opening_balance' | 'income' | 'expense' | 'transfer' | 'adjustment';
export type JournalStatus = 'posted' | 'voided';
export type EntryDirection = 'increase' | 'decrease';
export type TransactionAuditAction = 'created' | 'voided' | 'replaced';
export type JournalSourceType =
  'import_record' | 'group_submission' | 'reconciliation';

export const PERMISSIONS = {
  workspaceRead: 'workspace.read',
  workspaceCreate: 'workspace.create',
  membershipRead: 'membership.read',
  membershipManage: 'membership.manage',
  roleRead: 'role.read',
  roleManage: 'role.manage',
  accountRead: 'account.read',
  accountCreate: 'account.create',
  accountUpdate: 'account.update',
  accountAccessManage: 'account.access.manage',
  transactionRead: 'transaction.read',
  transactionCreate: 'transaction.create',
  transactionVoid: 'transaction.void',
  budgetRead: 'budget.read',
  budgetManage: 'budget.manage',
  reportRead: 'report.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface UserRecord {
  readonly id: string;
  displayName?: string;
  emailSnapshot?: string;
  readonly createdAt: Date;
}

export interface ExternalIdentityRecord {
  readonly providerIssuer: string;
  readonly providerSubject: string;
  readonly userId: string;
  emailSnapshot?: string;
  lastSeenAt: Date;
}

export interface RoleRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly protected: boolean;
  readonly permissions: ReadonlySet<string>;
}

export interface WorkspaceMemberRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  status: MembershipStatus;
  isOwner: boolean;
  readonly roleIds: readonly string[];
  readonly createdAt: Date;
}

export interface WorkspaceRecord {
  readonly id: string;
  name: string;
  readonly kind: WorkspaceKind;
  readonly defaultCurrency: CurrencyCode;
  status: WorkspaceStatus;
  readonly createdAt: Date;
}

export interface WorkspaceInvitationRecord {
  readonly id: string;
  readonly token: string;
  readonly workspaceId: string;
  readonly invitedUserId: string;
  readonly invitedByMemberId: string;
  readonly roleId?: string;
  status: InvitationStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  acceptedAt?: Date;
}

export interface OwnerTransferRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly fromMemberId: string;
  readonly targetMemberId: string;
  status: OwnerTransferStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  acceptedAt?: Date;
}

export interface AccountRecord {
  readonly id: string;
  readonly workspaceId: string;
  name: string;
  readonly iconKey: string;
  readonly kind: AccountKind;
  readonly currency: CurrencyCode;
  status: AccountStatus;
  visibilityMode: AccountVisibilityMode;
  readonly isSystem: boolean;
  balanceMinorUnits: bigint;
  readonly createdAt: Date;
}

export interface BudgetRecord {
  readonly id: string;
  readonly workspaceId: string;
  name: string;
  readonly parentId?: string;
  status: BudgetStatus;
  readonly createdAt: Date;
}

export interface TagRecord {
  readonly id: string;
  readonly workspaceId: string;
  name: string;
  status: BudgetStatus;
  readonly createdAt: Date;
}

export interface ClassificationLineRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly transactionId: string;
  readonly budgetId: string;
  readonly amountMinorUnits: bigint;
  readonly tagIds: readonly string[];
  readonly createdAt: Date;
}

export interface BudgetConstraintRecord {
  readonly id: string;
  readonly budgetPeriodId: string;
  readonly budgetId: string;
  readonly mode: BudgetConstraintMode;
  readonly fixedMinorUnits: bigint;
  readonly percentageBasisPoints: number;
  readonly rolloverMode: BudgetRolloverMode;
  readonly fundedByMemberId: string;
}

export interface BudgetPeriodRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly month: string;
  readonly baseMinorUnits: bigint;
  readonly carryMinorUnits: bigint;
  status: BudgetPeriodStatus;
  readonly createdByMemberId: string;
  readonly createdAt: Date;
  readonly constraintIds: readonly string[];
}

export interface JournalEntryRecord {
  readonly id: string;
  readonly accountId: string;
  readonly amountMinorUnits: bigint;
  readonly currency: CurrencyCode;
  readonly direction: EntryDirection;
}

export interface JournalTransactionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: JournalKind;
  status: JournalStatus;
  readonly amountMinorUnits: bigint;
  readonly currency: CurrencyCode;
  readonly exchangeRate?: string;
  readonly effectiveDate: string;
  readonly recordedAt: Date;
  readonly description?: string;
  readonly createdByMemberId: string;
  readonly reversalOfId?: string;
  readonly entries: readonly JournalEntryRecord[];
}

export interface TransactionAuditRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly transactionId: string;
  readonly actorMemberId: string;
  readonly action: TransactionAuditAction;
  readonly details?: Readonly<Record<string, string>>;
  readonly createdAt: Date;
}

export interface JournalSourceLinkRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly transactionId: string;
  readonly sourceType: JournalSourceType;
  readonly sourceId: string;
  readonly createdAt: Date;
}

export interface IdempotencyRecord {
  readonly workspaceId: string;
  readonly key: string;
  readonly operation: string;
  readonly requestHash: string;
  readonly response: object;
}
