import { MVP_CURRENCY } from '../../shared/domain/money';

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
export type AccountVisibilityMode =
  'workspace_default' | 'exclude_selected' | 'include_only' | 'owner_only';
export type JournalKind =
  'opening_balance' | 'income' | 'expense' | 'transfer' | 'adjustment';
export type JournalStatus = 'posted' | 'voided';
export type EntryDirection = 'increase' | 'decrease';
export type TransactionAuditAction = 'created' | 'voided' | 'replaced';

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
  readonly defaultCurrency: typeof MVP_CURRENCY;
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
  readonly kind: AccountKind;
  readonly currency: typeof MVP_CURRENCY;
  status: AccountStatus;
  visibilityMode: AccountVisibilityMode;
  readonly isSystem: boolean;
  balanceMinorUnits: bigint;
  readonly createdAt: Date;
}

export interface JournalEntryRecord {
  readonly id: string;
  readonly accountId: string;
  readonly amountMinorUnits: bigint;
  readonly direction: EntryDirection;
}

export interface JournalTransactionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: JournalKind;
  status: JournalStatus;
  readonly amountMinorUnits: bigint;
  readonly currency: typeof MVP_CURRENCY;
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

export interface IdempotencyRecord {
  readonly workspaceId: string;
  readonly key: string;
  readonly operation: string;
  readonly requestHash: string;
  readonly response: object;
}
