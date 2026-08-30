import { createHash, randomUUID } from 'node:crypto';
import { FinwiseError } from '../../shared/errors/finwise-error';
import { AuthenticatedActor } from '../../shared/application/auth';
import {
  AccountKind,
  AccountRecord,
  AccountVisibilityMode,
  ExternalIdentityRecord,
  IdempotencyRecord,
  JournalTransactionRecord,
  PERMISSIONS,
  Permission,
  RoleRecord,
  TransactionAuditAction,
  TransactionAuditRecord,
  UserRecord,
  WorkspaceKind,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from '../domain/ledger.types';
import { MVP_CURRENCY } from '../../shared/domain/money';
import {
  BootstrapResult,
  CoreStorePort,
  JournalDraft,
} from '../application/core.ports';

interface AccountAccessOverride {
  readonly accountId: string;
  readonly memberId: string;
  allowed: boolean;
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
  private readonly idempotencies = new Map<string, IdempotencyRecord>();
  private readonly accountAccess = new Map<string, AccountAccessOverride>();
  private readonly personalWorkspaceByUser = new Map<string, string>();

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
      this.assignRole(ownerMember.id, this.requireOwnerRole(workspace.id).id);
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
    const workspace = this.createWorkspaceInternal(name, kind);
    const ownerMember = this.createMemberInternal(
      workspace.id,
      actor.userId,
      true,
    );
    this.assignRole(ownerMember.id, this.requireOwnerRole(workspace.id).id);
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

  private assignRole(memberId: string, roleId: string): void {
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
