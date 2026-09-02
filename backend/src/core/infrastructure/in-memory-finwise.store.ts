import { createHash, randomUUID } from 'node:crypto';
import { FinwiseError } from '../../shared/errors/finwise-error';
import { AuthenticatedActor } from '../../shared/application/auth';
import {
  AccountKind,
  AccountRecord,
  AccountVisibilityMode,
  BudgetConstraintRecord,
  BudgetPeriodRecord,
  CategoryRecord,
  ClassificationLineRecord,
  TagRecord,
  ExternalIdentityRecord,
  IdempotencyRecord,
  JournalTransactionRecord,
  JournalSourceLinkRecord,
  OwnerTransferRecord,
  PERMISSIONS,
  Permission,
  RoleRecord,
  TransactionAuditAction,
  TransactionAuditRecord,
  UserRecord,
  WorkspaceInvitationRecord,
  WorkspaceKind,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from '../domain/ledger.types';
import { MVP_CURRENCY } from '../../shared/domain/money';
import { calculateBudgetAllocations } from '../domain/budget-allocation';
import {
  BootstrapResult,
  BudgetConstraintDraft,
  BudgetOverviewProjection,
  CoreStorePort,
  ClassificationLineDraft,
  JournalDraft,
} from '../application/core.ports';

interface AccountAccessOverride {
  readonly accountId: string;
  readonly memberId: string;
  allowed: boolean;
}

function normalizeRoleName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 100) {
    throw FinwiseError.validation(
      'Role name must be between 1 and 100 characters.',
      { field: 'name' },
    );
  }
  return name;
}

function normalizeLabel(value: string, resource: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 100) {
    throw FinwiseError.validation(
      `${resource} name must be between 1 and 100 characters.`,
      { field: 'name' },
    );
  }
  return name;
}

export class InMemoryFinwiseStore implements CoreStorePort {
  private readonly users = new Map<string, UserRecord>();
  private readonly identities = new Map<string, ExternalIdentityRecord>();
  private readonly workspaces = new Map<string, WorkspaceRecord>();
  private readonly members = new Map<string, WorkspaceMemberRecord>();
  private readonly membersByWorkspaceUser = new Map<string, string>();
  private readonly roles = new Map<string, RoleRecord>();
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly transactions = new Map<string, JournalTransactionRecord>();
  private readonly audits = new Map<string, TransactionAuditRecord>();
  private readonly sourceLinks = new Map<string, JournalSourceLinkRecord>();
  private readonly idempotencies = new Map<string, IdempotencyRecord>();
  private readonly accountAccess = new Map<string, AccountAccessOverride>();
  private readonly personalWorkspaceByUser = new Map<string, string>();
  private readonly invitations = new Map<string, WorkspaceInvitationRecord>();
  private readonly invitationsByToken = new Map<
    string,
    WorkspaceInvitationRecord
  >();
  private readonly ownerTransfers = new Map<string, OwnerTransferRecord>();
  private readonly categories = new Map<string, CategoryRecord>();
  private readonly tags = new Map<string, TagRecord>();
  private readonly classifications = new Map<
    string,
    readonly ClassificationLineRecord[]
  >();
  private readonly budgetPeriods = new Map<string, BudgetPeriodRecord>();
  private readonly budgetConstraints = new Map<
    string,
    BudgetConstraintRecord
  >();

  bootstrap(actor: AuthenticatedActor): BootstrapResult {
    const identityKey = `${actor.providerIssuer}:${actor.providerSubject}`;
    const now = new Date();
    let identity = this.identities.get(identityKey);
    let user = identity ? this.users.get(identity.userId) : undefined;

    if (!identity || !user) {
      const userId = randomUUID();
      user = {
        id: userId,
        displayName: actor.displayName,
        emailSnapshot: actor.email,
        createdAt: now,
      };
      identity = {
        providerIssuer: actor.providerIssuer,
        providerSubject: actor.providerSubject,
        userId,
        emailSnapshot: actor.email,
        lastSeenAt: now,
      };
      this.users.set(userId, user);
      this.identities.set(identityKey, identity);
    } else {
      user.displayName = actor.displayName ?? user.displayName;
      user.emailSnapshot = actor.email ?? user.emailSnapshot;
      identity.lastSeenAt = now;
      identity.emailSnapshot = actor.email ?? identity.emailSnapshot;
    }

    if (!user) {
      throw FinwiseError.provisioning(
        'Could not provision the internal identity.',
      );
    }

    let personalWorkspaceId = this.personalWorkspaceByUser.get(user.id);
    if (!personalWorkspaceId) {
      const workspace = this.createWorkspaceInternal('Personal', 'personal');
      const ownerMember = this.createMemberInternal(
        workspace.id,
        user.id,
        true,
      );
      this.assignRoleInternal(
        ownerMember.id,
        this.requireOwnerRole(workspace.id).id,
      );
      personalWorkspaceId = workspace.id;
      this.personalWorkspaceByUser.set(user.id, workspace.id);
    }

    const userWorkspaces = [...this.members.values()]
      .filter(
        (member) => member.userId === user.id && member.status === 'active',
      )
      .map((member) => this.workspaces.get(member.workspaceId))
      .filter(
        (workspace): workspace is WorkspaceRecord => workspace !== undefined,
      )
      .filter((workspace) => workspace.status === 'active');

    return {
      user,
      workspaces: userWorkspaces,
      suggestedWorkspaceId: personalWorkspaceId,
    };
  }

  createWorkspace(
    actor: AuthenticatedActor,
    name: string,
    kind: WorkspaceKind,
  ): WorkspaceRecord {
    const member = this.requireMemberByUser('', actor.userId, true);
    if (!this.hasPermission(member, PERMISSIONS.workspaceCreate)) {
      throw FinwiseError.permission();
    }
    const internalUserId = this.resolveInternalUserId(actor.userId);
    const workspace = this.createWorkspaceInternal(name, kind);
    const ownerMember = this.createMemberInternal(
      workspace.id,
      internalUserId,
      true,
    );
    this.assignRoleInternal(
      ownerMember.id,
      this.requireOwnerRole(workspace.id).id,
    );
    return workspace;
  }

  getWorkspace(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): WorkspaceRecord {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || workspace.status !== 'active') {
      throw FinwiseError.notFound('Workspace');
    }
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    if (!this.hasPermission(member, PERMISSIONS.workspaceRead)) {
      throw FinwiseError.permission();
    }
    return workspace;
  }

  listMembers(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly WorkspaceMemberRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.membershipRead);
    return [...this.members.values()].filter(
      (candidate) =>
        candidate.workspaceId === workspaceId && candidate.status === 'active',
    );
  }

  createInvitation(
    workspaceId: string,
    actor: AuthenticatedActor,
    invitedUserId: string,
    roleId?: string,
  ): WorkspaceInvitationRecord {
    const actorMember = this.requireMemberByUser(
      workspaceId,
      actor.userId,
      false,
    );
    this.requirePermission(actorMember, PERMISSIONS.membershipManage);
    this.requireWritableWorkspace(workspaceId);
    const internalInvitedUserId = this.resolveInternalUserId(invitedUserId);
    const existingMember = this.membersByWorkspaceUser.get(
      `${workspaceId}:${internalInvitedUserId}`,
    );
    if (existingMember) {
      const member = this.members.get(existingMember);
      if (member?.status === 'active') {
        throw FinwiseError.conflict('The user is already an active member.');
      }
    }
    const hasPending = [...this.invitations.values()].some(
      (invitation) =>
        invitation.workspaceId === workspaceId &&
        invitation.invitedUserId === internalInvitedUserId &&
        this.refreshInvitationStatus(invitation) === 'pending',
    );
    if (hasPending) {
      throw FinwiseError.conflict('A pending invitation already exists.');
    }
    if (roleId !== undefined) {
      this.requireRole(workspaceId, roleId);
    }
    const createdAt = new Date();
    const invitation: WorkspaceInvitationRecord = {
      id: randomUUID(),
      token: randomUUID(),
      workspaceId,
      invitedUserId: internalInvitedUserId,
      invitedByMemberId: actorMember.id,
      roleId,
      status: 'pending',
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
    this.invitations.set(invitation.id, invitation);
    this.invitationsByToken.set(invitation.token, invitation);
    return invitation;
  }

  listInvitations(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly WorkspaceInvitationRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.membershipRead);
    return [...this.invitations.values()]
      .filter((invitation) => invitation.workspaceId === workspaceId)
      .map((invitation) => {
        this.refreshInvitationStatus(invitation);
        return invitation;
      })
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
  }

  acceptInvitation(
    token: string,
    actor: AuthenticatedActor,
  ): WorkspaceMemberRecord {
    const invitation = this.invitationsByToken.get(token);
    if (!invitation) {
      throw FinwiseError.notFound('Invitation');
    }
    if (this.refreshInvitationStatus(invitation) !== 'pending') {
      throw FinwiseError.businessState(
        'Only pending invitations can be accepted.',
      );
    }
    const workspace = this.workspaces.get(invitation.workspaceId);
    if (!workspace || workspace.status !== 'active') {
      throw FinwiseError.businessState(
        'Archived workspaces cannot accept invitations.',
      );
    }
    const internalUserId = this.resolveInternalUserId(actor.userId);
    if (internalUserId !== invitation.invitedUserId) {
      throw FinwiseError.permission(
        'Only the invited user can accept this invitation.',
      );
    }
    const existingMemberId = this.membersByWorkspaceUser.get(
      `${invitation.workspaceId}:${internalUserId}`,
    );
    const existingMember = existingMemberId
      ? this.members.get(existingMemberId)
      : undefined;
    if (existingMember?.status === 'active') {
      throw FinwiseError.conflict('The user is already an active member.');
    }
    const member = this.createMemberInternal(
      invitation.workspaceId,
      internalUserId,
      false,
    );
    if (invitation.roleId) {
      this.assignRoleInternal(member.id, invitation.roleId);
    }
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    return member;
  }

  revokeInvitation(
    workspaceId: string,
    actor: AuthenticatedActor,
    invitationId: string,
  ): WorkspaceInvitationRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.membershipManage);
    const invitation = this.invitations.get(invitationId);
    if (!invitation || invitation.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Invitation');
    }
    if (this.refreshInvitationStatus(invitation) !== 'pending') {
      throw FinwiseError.businessState(
        'Only pending invitations can be revoked.',
      );
    }
    invitation.status = 'revoked';
    return invitation;
  }

  removeMember(
    workspaceId: string,
    actor: AuthenticatedActor,
    memberId: string,
  ): WorkspaceMemberRecord {
    const actorMember = this.requireMemberByUser(
      workspaceId,
      actor.userId,
      false,
    );
    this.requirePermission(actorMember, PERMISSIONS.membershipManage);
    const target = this.members.get(memberId);
    if (
      !target ||
      target.workspaceId !== workspaceId ||
      target.status !== 'active'
    ) {
      throw FinwiseError.notFound('Workspace member');
    }
    if (target.isOwner) {
      throw FinwiseError.conflict(
        'Transfer ownership before removing the workspace owner.',
      );
    }
    target.status = 'removed';
    const membershipKey = `${workspaceId}:${target.userId}`;
    if (this.membersByWorkspaceUser.get(membershipKey) === target.id) {
      this.membersByWorkspaceUser.delete(membershipKey);
    }
    return target;
  }

  initiateOwnerTransfer(
    workspaceId: string,
    actor: AuthenticatedActor,
    targetMemberId: string,
  ): OwnerTransferRecord {
    const sourceMember = this.requireMemberByUser(
      workspaceId,
      actor.userId,
      false,
    );
    if (!sourceMember.isOwner) {
      throw FinwiseError.permission(
        'Only the current owner can transfer ownership.',
      );
    }
    this.requireWritableWorkspace(workspaceId);
    const targetMember = this.members.get(targetMemberId);
    if (
      !targetMember ||
      targetMember.workspaceId !== workspaceId ||
      targetMember.status !== 'active'
    ) {
      throw FinwiseError.notFound('Workspace member');
    }
    if (targetMember.isOwner) {
      throw FinwiseError.conflict('The target member is already the owner.');
    }
    const pending = [...this.ownerTransfers.values()].find(
      (transfer) =>
        transfer.workspaceId === workspaceId &&
        this.refreshOwnerTransferStatus(transfer) === 'pending',
    );
    if (pending) {
      throw FinwiseError.conflict('An owner transfer is already pending.');
    }
    const createdAt = new Date();
    const transfer: OwnerTransferRecord = {
      id: randomUUID(),
      workspaceId,
      fromMemberId: sourceMember.id,
      targetMemberId,
      status: 'pending',
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
    this.ownerTransfers.set(transfer.id, transfer);
    return transfer;
  }

  acceptOwnerTransfer(
    transferId: string,
    actor: AuthenticatedActor,
  ): OwnerTransferRecord {
    const transfer = this.ownerTransfers.get(transferId);
    if (!transfer) {
      throw FinwiseError.notFound('Owner transfer');
    }
    if (this.refreshOwnerTransferStatus(transfer) !== 'pending') {
      throw FinwiseError.businessState(
        'Only pending owner transfers can be accepted.',
      );
    }
    const target = this.members.get(transfer.targetMemberId);
    const source = this.members.get(transfer.fromMemberId);
    if (
      !target ||
      !source ||
      target.status !== 'active' ||
      source.status !== 'active' ||
      !source.isOwner
    ) {
      throw FinwiseError.businessState(
        'The owner transfer target or source is no longer active.',
      );
    }
    const internalUserId = this.resolveInternalUserId(actor.userId);
    if (target.userId !== internalUserId) {
      throw FinwiseError.permission(
        'Only the transfer target can accept ownership.',
      );
    }
    const ownerRole = this.requireOwnerRole(transfer.workspaceId);
    source.isOwner = false;
    target.isOwner = true;
    removeRoleId(source, ownerRole.id);
    if (!target.roleIds.includes(ownerRole.id)) {
      (target.roleIds as string[]).push(ownerRole.id);
    }
    transfer.status = 'accepted';
    transfer.acceptedAt = new Date();
    return transfer;
  }

  cancelOwnerTransfer(
    workspaceId: string,
    actor: AuthenticatedActor,
    transferId: string,
  ): OwnerTransferRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    if (!member.isOwner) {
      throw FinwiseError.permission(
        'Only the current owner can cancel an owner transfer.',
      );
    }
    const transfer = this.ownerTransfers.get(transferId);
    if (!transfer || transfer.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Owner transfer');
    }
    if (this.refreshOwnerTransferStatus(transfer) !== 'pending') {
      throw FinwiseError.businessState(
        'Only pending owner transfers can be cancelled.',
      );
    }
    transfer.status = 'cancelled';
    return transfer;
  }

  archiveWorkspace(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): WorkspaceRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    if (!member.isOwner) {
      throw FinwiseError.permission('Only the workspace owner can archive it.');
    }
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw FinwiseError.notFound('Workspace');
    }
    if (workspace.status === 'archived') {
      throw FinwiseError.businessState('Workspace is already archived.');
    }
    workspace.status = 'archived';
    return workspace;
  }

  listRoles(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly RoleRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.roleRead);
    return [...this.roles.values()].filter(
      (role) => role.workspaceId === workspaceId,
    );
  }

  createRole(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
    permissions: readonly string[],
  ): RoleRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.roleManage);
    const normalizedName = normalizeRoleName(name);
    this.ensureRoleNameAvailable(workspaceId, normalizedName);
    const role: RoleRecord = {
      id: randomUUID(),
      workspaceId,
      name: normalizedName,
      protected: false,
      permissions: new Set(this.validatePermissions(permissions)),
    };
    this.roles.set(role.id, role);
    return role;
  }

  updateRole(
    workspaceId: string,
    actor: AuthenticatedActor,
    roleId: string,
    name: string,
    permissions: readonly string[],
  ): RoleRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.roleManage);
    const role = this.requireRole(workspaceId, roleId);
    if (role.protected) {
      throw FinwiseError.conflict(
        'The protected owner role cannot be changed.',
      );
    }
    const normalizedName = normalizeRoleName(name);
    this.ensureRoleNameAvailable(workspaceId, normalizedName, roleId);
    const updatedRole: RoleRecord = {
      ...role,
      name: normalizedName,
      permissions: new Set(this.validatePermissions(permissions)),
    };
    this.roles.set(role.id, updatedRole);
    return updatedRole;
  }

  deleteRole(
    workspaceId: string,
    actor: AuthenticatedActor,
    roleId: string,
  ): void {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.roleManage);
    const role = this.requireRole(workspaceId, roleId);
    if (role.protected) {
      throw FinwiseError.conflict(
        'The protected owner role cannot be deleted.',
      );
    }
    if (
      [...this.members.values()].some(
        (candidate) =>
          candidate.workspaceId === workspaceId &&
          candidate.roleIds.includes(roleId),
      )
    ) {
      throw FinwiseError.conflict(
        'Remove role assignments before deleting the role.',
      );
    }
    this.roles.delete(roleId);
  }

  assignRole(
    workspaceId: string,
    actor: AuthenticatedActor,
    memberId: string,
    roleId: string,
  ): WorkspaceMemberRecord {
    const actorMember = this.requireMemberByUser(
      workspaceId,
      actor.userId,
      false,
    );
    this.requirePermission(actorMember, PERMISSIONS.roleManage);
    const targetMember = this.members.get(memberId);
    if (
      !targetMember ||
      targetMember.workspaceId !== workspaceId ||
      targetMember.status !== 'active'
    ) {
      throw FinwiseError.notFound('Workspace member');
    }
    this.requireRole(workspaceId, roleId);
    if (!targetMember.roleIds.includes(roleId)) {
      (targetMember.roleIds as string[]).push(roleId);
    }
    return targetMember;
  }

  updateAccountAccess(
    workspaceId: string,
    actor: AuthenticatedActor,
    accountId: string,
    visibilityMode: AccountVisibilityMode,
    memberId?: string,
    allowed?: boolean,
  ): AccountRecord {
    const actorMember = this.requireMemberByUser(
      workspaceId,
      actor.userId,
      false,
    );
    this.requirePermission(actorMember, PERMISSIONS.accountAccessManage);
    const account = this.requireAccount(workspaceId, accountId);
    if (memberId === undefined) {
      account.visibilityMode = visibilityMode;
      return account;
    }
    const targetMember = this.members.get(memberId);
    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Workspace member');
    }
    if (targetMember.isOwner && allowed === false) {
      throw FinwiseError.conflict('The workspace owner cannot be hidden.');
    }
    if (allowed === undefined) {
      throw FinwiseError.validation(
        'allowed is required for a member override.',
        {
          field: 'allowed',
        },
      );
    }
    this.accountAccess.set(`${account.id}:${targetMember.id}`, {
      accountId: account.id,
      memberId: targetMember.id,
      allowed,
    });
    return account;
  }

  memberIdFor(workspaceId: string, userId: string): string {
    return this.requireMemberByUser(workspaceId, userId, false).id;
  }

  createAccount(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
    kind: AccountKind,
    visibilityMode: AccountVisibilityMode,
  ): AccountRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.accountCreate);
    this.requireWritableWorkspace(workspaceId);
    if (kind === 'system') {
      throw FinwiseError.validation(
        'System accounts are managed by the ledger.',
      );
    }
    const account: AccountRecord = {
      id: randomUUID(),
      workspaceId,
      name,
      kind,
      currency: MVP_CURRENCY,
      status: 'active',
      visibilityMode,
      isSystem: false,
      balanceMinorUnits: 0n,
      createdAt: new Date(),
    };
    this.accounts.set(account.id, account);
    return account;
  }

  listAccounts(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly AccountRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.accountRead);
    return [...this.accounts.values()].filter(
      (account) =>
        account.workspaceId === workspaceId &&
        account.status === 'active' &&
        !account.isSystem &&
        this.canAccessAccount(account, member),
    );
  }

  hasPartialAccountAccess(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): boolean {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.accountRead);
    const accounts = [...this.accounts.values()].filter(
      (account) =>
        account.workspaceId === workspaceId &&
        account.status === 'active' &&
        !account.isSystem,
    );
    return accounts.some((account) => !this.canAccessAccount(account, member));
  }

  getAccount(
    workspaceId: string,
    accountId: string,
    actor: AuthenticatedActor,
  ): AccountRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.accountRead);
    const account = this.requireAccount(workspaceId, accountId);
    if (account.isSystem || !this.canAccessAccount(account, member)) {
      throw FinwiseError.notFound('Account');
    }
    return account;
  }

  archiveAccount(
    workspaceId: string,
    accountId: string,
    actor: AuthenticatedActor,
  ): AccountRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.accountUpdate);
    const account = this.requireAccount(workspaceId, accountId);
    if (account.isSystem) {
      throw FinwiseError.conflict('System accounts cannot be archived.');
    }
    if (account.status === 'archived') {
      throw FinwiseError.businessState('Account is already archived.');
    }
    account.status = 'archived';
    return account;
  }

  systemAccount(workspaceId: string, purpose: string): AccountRecord {
    const existing = [...this.accounts.values()].find(
      (account) =>
        account.workspaceId === workspaceId &&
        account.isSystem &&
        account.name === purpose,
    );
    if (existing) {
      return existing;
    }
    const account: AccountRecord = {
      id: randomUUID(),
      workspaceId,
      name: purpose,
      kind: 'system',
      currency: MVP_CURRENCY,
      status: 'active',
      visibilityMode: 'owner_only',
      isSystem: true,
      balanceMinorUnits: 0n,
      createdAt: new Date(),
    };
    this.accounts.set(account.id, account);
    return account;
  }

  postJournal(draft: JournalDraft): JournalTransactionRecord {
    this.requireWritableWorkspace(draft.workspaceId);
    const member = this.members.get(draft.createdByMemberId);
    if (
      !member ||
      member.workspaceId !== draft.workspaceId ||
      member.status !== 'active'
    ) {
      throw FinwiseError.membership();
    }
    this.requirePermission(member, PERMISSIONS.transactionCreate);
    if (draft.entries.length < 2) {
      throw FinwiseError.validation('A journal needs at least two entries.');
    }
    if (draft.amountMinorUnits <= 0n) {
      throw FinwiseError.validation('Journal amount must be positive.');
    }
    let increases = 0n;
    let decreases = 0n;
    for (const entry of draft.entries) {
      if (entry.amountMinorUnits <= 0n) {
        throw FinwiseError.validation(
          'Journal entry amounts must be positive.',
        );
      }
      const account = this.requireAccount(draft.workspaceId, entry.accountId);
      if (account.status !== 'active') {
        throw FinwiseError.businessState(
          'Archived accounts cannot receive postings.',
        );
      }
      if (entry.direction === 'increase') {
        increases += entry.amountMinorUnits;
      } else {
        decreases += entry.amountMinorUnits;
      }
    }
    if (increases !== decreases || increases !== draft.amountMinorUnits) {
      throw FinwiseError.validation(
        'Journal entries must balance to the transaction amount.',
      );
    }
    const transaction: JournalTransactionRecord = {
      id: randomUUID(),
      workspaceId: draft.workspaceId,
      kind: draft.kind,
      status: 'posted',
      amountMinorUnits: draft.amountMinorUnits,
      currency: MVP_CURRENCY,
      effectiveDate: draft.effectiveDate,
      recordedAt: new Date(),
      description: draft.description,
      createdByMemberId: draft.createdByMemberId,
      reversalOfId: draft.reversalOfId,
      entries: draft.entries.map((entry) => ({ ...entry, id: randomUUID() })),
    };

    for (const entry of transaction.entries) {
      const account = this.accounts.get(entry.accountId);
      if (!account) {
        throw FinwiseError.notFound('Account');
      }
      const delta =
        entry.direction === 'increase'
          ? entry.amountMinorUnits
          : -entry.amountMinorUnits;
      account.balanceMinorUnits += delta;
    }
    this.transactions.set(transaction.id, transaction);
    this.addAudit(
      transaction.workspaceId,
      transaction.id,
      member.id,
      'created',
    );
    return transaction;
  }

  getTransaction(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
  ): JournalTransactionRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.transactionRead);
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Transaction');
    }
    if (!this.canViewTransaction(transaction, member)) {
      throw FinwiseError.notFound('Transaction');
    }
    return transaction;
  }

  listTransactions(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly JournalTransactionRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.transactionRead);
    return [...this.transactions.values()]
      .filter((transaction) => transaction.workspaceId === workspaceId)
      .filter((transaction) => this.canViewTransaction(transaction, member))
      .sort((left, right) =>
        right.effectiveDate.localeCompare(left.effectiveDate),
      );
  }

  assertReportAccess(workspaceId: string, actor: AuthenticatedActor): void {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.reportRead);
  }

  voidTransaction(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
    reason: string,
    effectiveDate: string,
  ): {
    readonly original: JournalTransactionRecord;
    readonly reversal: JournalTransactionRecord;
  } {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.transactionVoid);
    const original = this.getTransaction(workspaceId, transactionId, actor);
    if (original.status !== 'posted') {
      throw FinwiseError.businessState(
        'Only posted transactions can be voided.',
      );
    }
    const reversal = this.postJournal({
      workspaceId,
      kind: 'adjustment',
      amountMinorUnits: original.amountMinorUnits,
      effectiveDate,
      description: `Void ${original.id}: ${reason}`,
      createdByMemberId: member.id,
      reversalOfId: original.id,
      entries: original.entries.map((entry) => ({
        accountId: entry.accountId,
        amountMinorUnits: entry.amountMinorUnits,
        direction: entry.direction === 'increase' ? 'decrease' : 'increase',
      })),
    });
    original.status = 'voided';
    this.addAudit(workspaceId, original.id, member.id, 'voided', {
      reversalId: reversal.id,
      reason,
    });
    return { original, reversal };
  }

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
  } {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.transactionVoid);
    const original = this.getTransaction(workspaceId, transactionId, actor);
    if (original.status !== 'posted') {
      throw FinwiseError.businessState(
        'Only posted transactions can be replaced.',
      );
    }
    this.validateJournalDraft(replacement);
    const reversal = this.postJournal({
      workspaceId,
      kind: 'adjustment',
      amountMinorUnits: original.amountMinorUnits,
      effectiveDate,
      description: `Reverse ${original.id}: ${reason}`,
      createdByMemberId: member.id,
      reversalOfId: original.id,
      entries: original.entries.map((entry) => ({
        accountId: entry.accountId,
        amountMinorUnits: entry.amountMinorUnits,
        direction: entry.direction === 'increase' ? 'decrease' : 'increase',
      })),
    });
    original.status = 'voided';
    this.addAudit(workspaceId, original.id, member.id, 'replaced', {
      reversalId: reversal.id,
      reason,
    });
    const replacementTransaction = this.postJournal(replacement);
    return {
      original,
      reversal,
      replacement: replacementTransaction,
    };
  }

  rebuildBalances(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly {
    readonly accountId: string;
    readonly balanceMinorUnits: bigint;
  }[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.accountRead);
    const balances = new Map<string, bigint>();
    for (const account of this.accounts.values()) {
      if (
        account.workspaceId === workspaceId &&
        account.status === 'active' &&
        !account.isSystem &&
        this.canAccessAccount(account, member)
      ) {
        balances.set(account.id, 0n);
      }
    }
    for (const transaction of this.transactions.values()) {
      if (transaction.workspaceId !== workspaceId) {
        continue;
      }
      for (const entry of transaction.entries) {
        const current = balances.get(entry.accountId);
        if (current === undefined) continue;
        const delta =
          entry.direction === 'increase'
            ? entry.amountMinorUnits
            : -entry.amountMinorUnits;
        balances.set(entry.accountId, current + delta);
      }
    }
    return [...balances.entries()].map(([accountId, balanceMinorUnits]) => ({
      accountId,
      balanceMinorUnits,
    }));
  }

  createCategory(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
    parentId?: string,
  ): CategoryRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.categoryManage);
    const normalizedName = normalizeLabel(name, 'Category');
    let parent: CategoryRecord | undefined;
    if (parentId !== undefined) {
      parent = this.requireCategory(workspaceId, parentId);
      if (parent.status !== 'active') {
        throw FinwiseError.businessState(
          'Archived categories cannot receive children.',
        );
      }
      if (parent.parentId !== undefined) {
        throw FinwiseError.validation(
          'Categories may have at most two levels.',
        );
      }
    }
    const duplicate = [...this.categories.values()].some(
      (category) =>
        category.workspaceId === workspaceId &&
        category.status === 'active' &&
        category.parentId === parent?.id &&
        category.name.toLocaleLowerCase() ===
          normalizedName.toLocaleLowerCase(),
    );
    if (duplicate) {
      throw FinwiseError.conflict('A category with this name already exists.');
    }
    const category: CategoryRecord = {
      id: randomUUID(),
      workspaceId,
      name: normalizedName,
      parentId: parent?.id,
      status: 'active',
      createdAt: new Date(),
    };
    this.categories.set(category.id, category);
    return category;
  }

  listCategories(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly CategoryRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.categoryRead);
    return [...this.categories.values()]
      .filter((category) => category.workspaceId === workspaceId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  archiveCategory(
    workspaceId: string,
    actor: AuthenticatedActor,
    categoryId: string,
  ): CategoryRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.categoryManage);
    const category = this.requireCategory(workspaceId, categoryId);
    if (category.status === 'archived') {
      throw FinwiseError.businessState('Category is already archived.');
    }
    const hasActiveChildren = [...this.categories.values()].some(
      (candidate) =>
        candidate.parentId === category.id && candidate.status === 'active',
    );
    if (hasActiveChildren) {
      throw FinwiseError.conflict(
        'Archive child categories before archiving their parent.',
      );
    }
    category.status = 'archived';
    return category;
  }

  createTag(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
  ): TagRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.categoryManage);
    const normalizedName = normalizeLabel(name, 'Tag');
    const duplicate = [...this.tags.values()].some(
      (tag) =>
        tag.workspaceId === workspaceId &&
        tag.status === 'active' &&
        tag.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
    );
    if (duplicate) {
      throw FinwiseError.conflict('A tag with this name already exists.');
    }
    const tag: TagRecord = {
      id: randomUUID(),
      workspaceId,
      name: normalizedName,
      status: 'active',
      createdAt: new Date(),
    };
    this.tags.set(tag.id, tag);
    return tag;
  }

  listTags(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly TagRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.categoryRead);
    return [...this.tags.values()]
      .filter((tag) => tag.workspaceId === workspaceId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  classifyTransaction(
    workspaceId: string,
    actor: AuthenticatedActor,
    transactionId: string,
    lines: readonly ClassificationLineDraft[],
  ): readonly ClassificationLineRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.transactionCreate);
    const transaction = this.getTransaction(workspaceId, transactionId, actor);
    if (transaction.status !== 'posted') {
      throw FinwiseError.businessState(
        'Only posted transactions can be classified.',
      );
    }
    if (this.classifications.has(transactionId)) {
      throw FinwiseError.conflict(
        'Transaction classification is immutable once posted.',
      );
    }
    if (lines.length === 0 || lines.length > 50) {
      throw FinwiseError.validation(
        'Classification must contain between 1 and 50 lines.',
      );
    }
    let total = 0n;
    const records: ClassificationLineRecord[] = [];
    for (const line of lines) {
      if (line.amountMinorUnits <= 0n) {
        throw FinwiseError.validation(
          'Classification line amounts must be positive.',
        );
      }
      const category = this.requireCategory(workspaceId, line.categoryId);
      if (category.status !== 'active') {
        throw FinwiseError.businessState(
          'Archived categories cannot classify new transactions.',
        );
      }
      if (this.categoryHasActiveChildren(category.id)) {
        throw FinwiseError.validation(
          'Post to a leaf category or create an Other child category.',
        );
      }
      const uniqueTagIds = [...new Set(line.tagIds)];
      for (const tagId of uniqueTagIds) {
        const tag = this.tags.get(tagId);
        if (
          !tag ||
          tag.workspaceId !== workspaceId ||
          tag.status !== 'active'
        ) {
          throw FinwiseError.notFound('Tag');
        }
      }
      total += line.amountMinorUnits;
      records.push({
        id: randomUUID(),
        workspaceId,
        transactionId,
        categoryId: category.id,
        amountMinorUnits: line.amountMinorUnits,
        tagIds: uniqueTagIds,
        createdAt: new Date(),
      });
    }
    if (total !== transaction.amountMinorUnits) {
      throw FinwiseError.validation(
        'Classification line amounts must equal the transaction amount.',
      );
    }
    this.classifications.set(transactionId, records);
    return records;
  }

  getClassification(
    workspaceId: string,
    actor: AuthenticatedActor,
    transactionId: string,
  ): readonly ClassificationLineRecord[] {
    this.getTransaction(workspaceId, transactionId, actor);
    return this.classifications.get(transactionId) ?? [];
  }

  createBudgetPeriod(
    workspaceId: string,
    actor: AuthenticatedActor,
    month: string,
    baseMinorUnits: bigint,
    constraints: readonly BudgetConstraintDraft[],
  ): BudgetPeriodRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.budgetManage);
    if (baseMinorUnits <= 0n) {
      throw FinwiseError.validation('Budget base must be positive.');
    }
    const key = `${workspaceId}:${month}`;
    if (
      [...this.budgetPeriods.values()].some(
        (period) => `${period.workspaceId}:${period.month}` === key,
      )
    ) {
      throw FinwiseError.conflict(
        'A budget period already exists for this month.',
      );
    }
    if (constraints.length > 100) {
      throw FinwiseError.validation(
        'A budget period cannot exceed 100 constraints.',
      );
    }
    const categoryIds = new Set<string>();
    let fixedTotal = 0n;
    let percentageTotal = 0;
    for (const constraint of constraints) {
      if (categoryIds.has(constraint.categoryId)) {
        throw FinwiseError.conflict(
          'A category may only have one budget constraint per period.',
        );
      }
      categoryIds.add(constraint.categoryId);
      const category = this.requireCategory(workspaceId, constraint.categoryId);
      if (category.status !== 'active') {
        throw FinwiseError.businessState(
          'Archived categories cannot be budgeted.',
        );
      }
      if (constraint.fixedMinorUnits < 0n) {
        throw FinwiseError.validation(
          'Budget fixed allocation cannot be negative.',
        );
      }
      if (
        !Number.isInteger(constraint.percentageBasisPoints) ||
        constraint.percentageBasisPoints < 0 ||
        constraint.percentageBasisPoints > 10000
      ) {
        throw FinwiseError.validation(
          'Budget percentage must be between 0 and 100 percent.',
        );
      }
      fixedTotal += constraint.fixedMinorUnits;
      percentageTotal += constraint.percentageBasisPoints;
    }
    if (fixedTotal > baseMinorUnits) {
      throw FinwiseError.validation(
        'Fixed budget allocations cannot exceed the period base.',
      );
    }
    if (percentageTotal > 10000) {
      throw FinwiseError.validation(
        'Budget percentages cannot exceed 100 percent.',
      );
    }
    const period: BudgetPeriodRecord = {
      id: randomUUID(),
      workspaceId,
      month,
      baseMinorUnits,
      carryMinorUnits: 0n,
      status: 'open',
      createdByMemberId: member.id,
      createdAt: new Date(),
      constraintIds: [],
    };
    this.budgetPeriods.set(period.id, period);
    const constraintIds = period.constraintIds as string[];
    for (const constraint of constraints) {
      const record: BudgetConstraintRecord = {
        id: randomUUID(),
        budgetPeriodId: period.id,
        categoryId: constraint.categoryId,
        mode: constraint.mode,
        fixedMinorUnits: constraint.fixedMinorUnits,
        percentageBasisPoints: constraint.percentageBasisPoints,
        rolloverMode: constraint.rolloverMode,
        fundedByMemberId: member.id,
      };
      this.budgetConstraints.set(record.id, record);
      constraintIds.push(record.id);
    }
    return period;
  }

  listBudgetPeriods(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly BudgetPeriodRecord[] {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.budgetRead);
    return [...this.budgetPeriods.values()]
      .filter((period) => period.workspaceId === workspaceId)
      .sort((left, right) => right.month.localeCompare(left.month));
  }

  getBudgetOverview(
    workspaceId: string,
    actor: AuthenticatedActor,
    month: string,
  ): BudgetOverviewProjection {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.budgetRead);
    const period = [...this.budgetPeriods.values()].find(
      (candidate) =>
        candidate.workspaceId === workspaceId && candidate.month === month,
    );
    if (!period) {
      throw FinwiseError.notFound('Budget period');
    }
    const constraints = period.constraintIds
      .map((constraintId) => this.budgetConstraints.get(constraintId))
      .filter(
        (constraint): constraint is BudgetConstraintRecord =>
          constraint !== undefined,
      );
    const allocations = calculateBudgetAllocations(
      period.baseMinorUnits,
      constraints,
      (categoryId, ancestorId) => this.isCategoryWithin(categoryId, ancestorId),
      (categoryId) => this.categoryDepth(categoryId),
    );
    const allocationById = new Map(
      allocations.map((allocation) => [allocation.constraintId, allocation]),
    );
    const projections = constraints.map((constraint) => {
      const allocated =
        allocationById.get(constraint.id)?.allocatedMinorUnits ?? 0n;
      let actual = 0n;
      for (const [transactionId, lines] of this.classifications.entries()) {
        const transaction = this.transactions.get(transactionId);
        if (
          !transaction ||
          transaction.workspaceId !== workspaceId ||
          transaction.kind !== 'expense' ||
          transaction.status !== 'posted' ||
          !transaction.effectiveDate.startsWith(month) ||
          !this.canViewTransaction(transaction, member)
        ) {
          continue;
        }
        for (const line of lines) {
          if (this.isCategoryWithin(line.categoryId, constraint.categoryId)) {
            actual += line.amountMinorUnits;
          }
        }
      }
      return {
        constraint,
        allocatedMinorUnits: allocated,
        actualMinorUnits: actual,
        remainingMinorUnits: allocated + period.carryMinorUnits - actual,
      };
    });
    return {
      period,
      constraints: projections,
      totalAllocatedMinorUnits: projections.reduce(
        (total, projection) =>
          total +
          (allocationById.get(projection.constraint.id)?.contributesToTotals
            ? projection.allocatedMinorUnits
            : 0n),
        0n,
      ),
      totalActualMinorUnits: projections.reduce(
        (total, projection) =>
          total +
          (allocationById.get(projection.constraint.id)?.contributesToTotals
            ? projection.actualMinorUnits
            : 0n),
        0n,
      ),
      totalRemainingMinorUnits: projections.reduce(
        (total, projection) =>
          total +
          (allocationById.get(projection.constraint.id)?.contributesToTotals
            ? projection.remainingMinorUnits
            : 0n),
        0n,
      ),
    };
  }

  closeBudgetPeriod(
    workspaceId: string,
    actor: AuthenticatedActor,
    month: string,
  ): BudgetPeriodRecord {
    const member = this.requireMemberByUser(workspaceId, actor.userId, false);
    this.requirePermission(member, PERMISSIONS.budgetManage);
    const period = [...this.budgetPeriods.values()].find(
      (candidate) =>
        candidate.workspaceId === workspaceId && candidate.month === month,
    );
    if (!period) {
      throw FinwiseError.notFound('Budget period');
    }
    if (period.status === 'closed') {
      throw FinwiseError.businessState('Budget period is already closed.');
    }
    period.status = 'closed';
    return period;
  }

  getIdempotency<T extends object>(
    workspaceId: string,
    key: string,
    operation: string,
    requestHash: string,
  ): T | undefined {
    const record = this.idempotencies.get(`${workspaceId}:${key}`);
    if (!record) {
      return undefined;
    }
    if (record.operation !== operation || record.requestHash !== requestHash) {
      throw FinwiseError.idempotencyReused();
    }
    return record.response as T;
  }

  saveIdempotency(
    workspaceId: string,
    key: string,
    operation: string,
    requestHash: string,
    response: object,
  ): void {
    const idempotencyRecord: IdempotencyRecord = {
      workspaceId,
      key,
      operation,
      requestHash,
      response,
    };
    this.idempotencies.set(`${workspaceId}:${key}`, idempotencyRecord);
  }

  hashRequest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  getAudits(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
  ): readonly TransactionAuditRecord[] {
    this.getTransaction(workspaceId, transactionId, actor);
    return [...this.audits.values()]
      .filter(
        (audit) =>
          audit.workspaceId === workspaceId &&
          audit.transactionId === transactionId,
      )
      .sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      );
  }

  linkJournalSource(
    workspaceId: string,
    transactionId: string,
    sourceType: JournalSourceLinkRecord['sourceType'],
    sourceId: string,
    actor: AuthenticatedActor,
  ): JournalSourceLinkRecord {
    this.getTransaction(workspaceId, transactionId, actor);
    if (!sourceId.trim())
      throw FinwiseError.validation('Source id is required.');
    const key = `${workspaceId}:${sourceType}:${sourceId}`;
    const existing = this.sourceLinks.get(key);
    if (existing) {
      if (existing.transactionId !== transactionId) {
        throw FinwiseError.conflict(
          'A source can link to only one transaction.',
        );
      }
      return existing;
    }
    const link: JournalSourceLinkRecord = {
      id: randomUUID(),
      workspaceId,
      transactionId,
      sourceType,
      sourceId: sourceId.trim(),
      createdAt: new Date(),
    };
    this.sourceLinks.set(key, link);
    return link;
  }

  getJournalSourceLinks(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
  ): readonly JournalSourceLinkRecord[] {
    this.getTransaction(workspaceId, transactionId, actor);
    return [...this.sourceLinks.values()]
      .filter(
        (link) =>
          link.workspaceId === workspaceId &&
          link.transactionId === transactionId,
      )
      .sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      );
  }

  private createWorkspaceInternal(
    name: string,
    kind: WorkspaceKind,
  ): WorkspaceRecord {
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      throw FinwiseError.validation(
        'Workspace name must be between 1 and 100 characters.',
      );
    }
    const workspace: WorkspaceRecord = {
      id: randomUUID(),
      name: trimmedName,
      kind,
      defaultCurrency: MVP_CURRENCY,
      status: 'active',
      createdAt: new Date(),
    };
    this.workspaces.set(workspace.id, workspace);
    const role = this.ownerRole(workspace.id);
    this.roles.set(role.id, role);
    return workspace;
  }

  private requireRole(workspaceId: string, roleId: string): RoleRecord {
    const role = this.roles.get(roleId);
    if (!role || role.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Role');
    }
    return role;
  }

  private requireCategory(
    workspaceId: string,
    categoryId: string,
  ): CategoryRecord {
    const category = this.categories.get(categoryId);
    if (!category || category.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Category');
    }
    return category;
  }

  private categoryHasActiveChildren(categoryId: string): boolean {
    return [...this.categories.values()].some(
      (candidate) =>
        candidate.parentId === categoryId && candidate.status === 'active',
    );
  }

  private isCategoryWithin(categoryId: string, ancestorId: string): boolean {
    let current = this.categories.get(categoryId);
    while (current) {
      if (current.id === ancestorId) return true;
      if (!current.parentId) return false;
      current = this.categories.get(current.parentId);
    }
    return false;
  }

  private categoryDepth(categoryId: string): number {
    let depth = 0;
    let current = this.categories.get(categoryId);
    while (current?.parentId) {
      depth += 1;
      current = this.categories.get(current.parentId);
    }
    return depth;
  }

  private validateJournalDraft(draft: JournalDraft): void {
    this.requireWritableWorkspace(draft.workspaceId);
    const member = this.members.get(draft.createdByMemberId);
    if (
      !member ||
      member.workspaceId !== draft.workspaceId ||
      member.status !== 'active'
    ) {
      throw FinwiseError.membership();
    }
    this.requirePermission(member, PERMISSIONS.transactionCreate);
    if (draft.entries.length < 2) {
      throw FinwiseError.validation('A journal needs at least two entries.');
    }
    if (draft.amountMinorUnits <= 0n) {
      throw FinwiseError.validation('Journal amount must be positive.');
    }
    let increases = 0n;
    let decreases = 0n;
    for (const entry of draft.entries) {
      if (entry.amountMinorUnits <= 0n) {
        throw FinwiseError.validation(
          'Journal entry amounts must be positive.',
        );
      }
      const account = this.requireAccount(draft.workspaceId, entry.accountId);
      if (account.status !== 'active') {
        throw FinwiseError.businessState(
          'Archived accounts cannot receive postings.',
        );
      }
      if (entry.direction === 'increase') {
        increases += entry.amountMinorUnits;
      } else {
        decreases += entry.amountMinorUnits;
      }
    }
    if (increases !== decreases || increases !== draft.amountMinorUnits) {
      throw FinwiseError.validation(
        'Journal entries must balance to the transaction amount.',
      );
    }
  }

  private refreshInvitationStatus(
    invitation: WorkspaceInvitationRecord,
  ): WorkspaceInvitationRecord['status'] {
    if (
      invitation.status === 'pending' &&
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      invitation.status = 'expired';
    }
    return invitation.status;
  }

  private refreshOwnerTransferStatus(
    transfer: OwnerTransferRecord,
  ): OwnerTransferRecord['status'] {
    if (
      transfer.status === 'pending' &&
      transfer.expiresAt.getTime() <= Date.now()
    ) {
      transfer.status = 'expired';
    }
    return transfer.status;
  }

  private ensureRoleNameAvailable(
    workspaceId: string,
    name: string,
    ignoredRoleId?: string,
  ): void {
    const duplicate = [...this.roles.values()].some(
      (role) =>
        role.workspaceId === workspaceId &&
        role.id !== ignoredRoleId &&
        role.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (duplicate) {
      throw FinwiseError.conflict('A role with this name already exists.');
    }
  }

  private validatePermissions(
    permissions: readonly string[],
  ): readonly Permission[] {
    const supportedPermissions = new Set<string>(Object.values(PERMISSIONS));
    const uniquePermissions = [...new Set(permissions)];
    if (
      uniquePermissions.some(
        (permission) => !supportedPermissions.has(permission),
      )
    ) {
      throw FinwiseError.validation(
        'Role contains an unsupported permission.',
        {
          field: 'permissions',
        },
      );
    }
    return uniquePermissions as Permission[];
  }

  private createMemberInternal(
    workspaceId: string,
    userId: string,
    isOwner: boolean,
  ): WorkspaceMemberRecord {
    const member: WorkspaceMemberRecord = {
      id: randomUUID(),
      workspaceId,
      userId,
      status: 'active',
      isOwner,
      roleIds: [],
      createdAt: new Date(),
    };
    this.members.set(member.id, member);
    this.membersByWorkspaceUser.set(`${workspaceId}:${userId}`, member.id);
    return member;
  }

  private ownerRole(workspaceId: string): RoleRecord {
    return {
      id: randomUUID(),
      workspaceId,
      name: 'Owner',
      protected: true,
      permissions: new Set(Object.values(PERMISSIONS)),
    };
  }

  private requireOwnerRole(workspaceId: string): RoleRecord {
    const role = [...this.roles.values()].find(
      (candidate) =>
        candidate.workspaceId === workspaceId && candidate.protected,
    );
    if (!role) {
      throw FinwiseError.provisioning('The protected owner role is missing.');
    }
    return role;
  }

  private assignRoleInternal(memberId: string, roleId: string): void {
    const member = this.members.get(memberId);
    if (!member) {
      throw FinwiseError.membership();
    }
    (member.roleIds as string[]).push(roleId);
  }

  private requireMemberByUser(
    workspaceId: string,
    userId: string,
    allowAnyWorkspace: boolean,
  ): WorkspaceMemberRecord {
    const internalUserId = this.resolveInternalUserId(userId);
    const member = allowAnyWorkspace
      ? [...this.members.values()].find(
          (candidate) =>
            candidate.userId === internalUserId &&
            candidate.status === 'active',
        )
      : this.members.get(
          this.membersByWorkspaceUser.get(`${workspaceId}:${internalUserId}`) ??
            '',
        );
    if (!member || member.status !== 'active') {
      throw FinwiseError.membership();
    }
    return member;
  }

  private resolveInternalUserId(externalOrInternalUserId: string): string {
    if (this.users.has(externalOrInternalUserId)) {
      return externalOrInternalUserId;
    }
    const identity = [...this.identities.values()].find(
      (candidate) => candidate.providerSubject === externalOrInternalUserId,
    );
    if (!identity) {
      throw FinwiseError.membership();
    }
    return identity.userId;
  }

  private requirePermission(
    member: WorkspaceMemberRecord,
    permission: Permission,
  ): void {
    if (!this.hasPermission(member, permission)) {
      throw FinwiseError.permission();
    }
  }

  private hasPermission(
    member: WorkspaceMemberRecord,
    permission: Permission,
  ): boolean {
    if (member.isOwner) {
      return true;
    }
    return member.roleIds.some(
      (roleId) => this.roles.get(roleId)?.permissions.has(permission) === true,
    );
  }

  private requireWritableWorkspace(workspaceId: string): WorkspaceRecord {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw FinwiseError.notFound('Workspace');
    }
    if (workspace.status !== 'active') {
      throw FinwiseError.businessState(
        'Archived workspaces cannot accept financial writes.',
      );
    }
    return workspace;
  }

  private requireAccount(
    workspaceId: string,
    accountId: string,
  ): AccountRecord {
    const account = this.accounts.get(accountId);
    if (!account || account.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Account');
    }
    return account;
  }

  private canAccessAccount(
    account: AccountRecord,
    member: WorkspaceMemberRecord,
  ): boolean {
    if (member.isOwner) {
      return true;
    }
    const override = this.accountAccess.get(`${account.id}:${member.id}`);
    if (account.visibilityMode === 'owner_only') {
      return false;
    }
    if (override?.allowed === false) {
      return false;
    }
    if (account.visibilityMode === 'include_only') {
      return override?.allowed === true;
    }
    return true;
  }

  private canViewTransaction(
    transaction: JournalTransactionRecord,
    member: WorkspaceMemberRecord,
  ): boolean {
    const userAccounts = transaction.entries
      .map((entry) => this.accounts.get(entry.accountId))
      .filter(
        (account): account is AccountRecord =>
          account !== undefined && !account.isSystem,
      );

    return (
      userAccounts.length > 0 &&
      userAccounts.every((account) => this.canAccessAccount(account, member))
    );
  }

  private addAudit(
    workspaceId: string,
    transactionId: string,
    actorMemberId: string,
    action: TransactionAuditAction,
    details?: Readonly<Record<string, string>>,
  ): void {
    const audit: TransactionAuditRecord = {
      id: randomUUID(),
      workspaceId,
      transactionId,
      actorMemberId,
      action,
      details,
      createdAt: new Date(),
    };
    this.audits.set(audit.id, audit);
  }
}

function removeRoleId(member: WorkspaceMemberRecord, roleId: string): void {
  const roleIds = member.roleIds as string[];
  const index = roleIds.indexOf(roleId);
  if (index >= 0) {
    roleIds.splice(index, 1);
  }
}
