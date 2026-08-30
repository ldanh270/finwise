import { AuthenticatedActor } from '../../shared/application/auth';
import { Money, MVP_CURRENCY } from '../../shared/domain/money';
import { FinwiseError } from '../../shared/errors/finwise-error';
import {
  AccountKind,
  AccountRecord,
  AccountVisibilityMode,
  JournalTransactionRecord,
  JournalKind,
  RoleRecord,
  WorkspaceMemberRecord,
  WorkspaceKind,
  WorkspaceInvitationRecord,
  OwnerTransferRecord,
} from '../domain/ledger.types';
import { BootstrapResult, CoreStorePort, JournalDraft } from './core.ports';

export interface WorkspaceResponse {
  readonly id: string;
  readonly name: string;
  readonly kind: WorkspaceKind;
  readonly intent: 'PERSONAL' | 'SHARED';
  readonly currency: typeof MVP_CURRENCY;
  readonly status: string;
}

export interface AccountResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly kind: AccountKind;
  readonly currency: typeof MVP_CURRENCY;
  readonly balanceMinorUnits: string;
  readonly visibilityMode: AccountVisibilityMode;
  readonly status: string;
}

export interface BalanceProjectionResponse {
  readonly accountId: string;
  readonly balanceMinorUnits: string;
}

export interface TransactionResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: JournalKind;
  readonly status: string;
  readonly amount: {
    readonly currency: typeof MVP_CURRENCY;
    readonly minorUnits: string;
  };
  readonly effectiveDate: string;
  readonly recordedAt: string;
  readonly description?: string;
  readonly reversalOfId?: string;
  readonly entries: readonly {
    readonly id: string;
    readonly accountId: string;
    readonly amountMinorUnits: string;
    readonly direction: string;
  }[];
}

export interface BootstrapResponse {
  readonly user: {
    readonly id: string;
    readonly displayName?: string;
    readonly email?: string;
  };
  readonly workspaces: readonly WorkspaceResponse[];
  readonly suggestedWorkspaceId: string;
}

export interface OverviewResponse {
  readonly workspaceId: string;
  readonly period: string;
  readonly accounts: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: 'CASH' | 'BANK' | 'SAVINGS' | 'OTHER';
    readonly balance: {
      readonly currency: typeof MVP_CURRENCY;
      readonly minorUnits: string;
    };
    readonly isArchived: boolean;
  }[];
  readonly recentTransactions: readonly {
    readonly id: string;
    readonly date: string;
    readonly description: string;
    readonly type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    readonly amount: {
      readonly currency: typeof MVP_CURRENCY;
      readonly minorUnits: string;
    };
    readonly accountName: string;
    readonly categoryName: string | null;
  }[];
  readonly budgets: readonly [];
  readonly totals: {
    readonly accountBalance: {
      readonly currency: typeof MVP_CURRENCY;
      readonly minorUnits: string;
    };
    readonly budgetRemaining: {
      readonly currency: typeof MVP_CURRENCY;
      readonly minorUnits: string;
    };
    readonly income: {
      readonly currency: typeof MVP_CURRENCY;
      readonly minorUnits: string;
    };
    readonly spending: {
      readonly currency: typeof MVP_CURRENCY;
      readonly minorUnits: string;
    };
  };
  readonly hasPartialAccess: boolean;
}

export interface RoleResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly protected: boolean;
  readonly permissions: readonly string[];
}

export interface MemberResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly status: string;
  readonly isOwner: boolean;
  readonly roleIds: readonly string[];
}

export interface InvitationResponse {
  readonly id: string;
  readonly token: string;
  readonly workspaceId: string;
  readonly invitedUserId: string;
  readonly invitedByMemberId: string;
  readonly roleId?: string;
  readonly status: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly acceptedAt?: string;
}

export interface OwnerTransferResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly fromMemberId: string;
  readonly targetMemberId: string;
  readonly status: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly acceptedAt?: string;
}

export class CoreService {
  constructor(private readonly store: CoreStorePort) {}

  bootstrap(actor: AuthenticatedActor): BootstrapResponse {
    const result = this.store.bootstrap(actor);
    return {
      user: {
        id: result.user.id,
        displayName:
          result.user.displayName ?? actor.displayName ?? actor.userId,
        email: result.user.emailSnapshot,
      },
      workspaces: result.workspaces.map((workspace) =>
        this.workspaceResponse(workspace),
      ),
      suggestedWorkspaceId: result.suggestedWorkspaceId,
    };
  }

  overview(actor: AuthenticatedActor, workspaceId: string): OverviewResponse {
    const accounts = this.store.listAccounts(workspaceId, actor);
    const accountById = new Map(
      accounts.map((account) => [account.id, account]),
    );
    const transactions = this.store.listTransactions(workspaceId, actor);
    const period = new Date().toISOString().slice(0, 7);
    let income = 0n;
    let spending = 0n;
    for (const transaction of transactions) {
      if (!transaction.effectiveDate.startsWith(period)) continue;
      if (transaction.kind === 'income') income += transaction.amountMinorUnits;
      if (transaction.kind === 'expense')
        spending += transaction.amountMinorUnits;
    }
    const accountBalance = accounts.reduce(
      (total, account) => total + account.balanceMinorUnits,
      0n,
    );
    return {
      workspaceId,
      period,
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: accountTypeForOverview(account.kind),
        balance: {
          currency: account.currency,
          minorUnits: account.balanceMinorUnits.toString(),
        },
        isArchived: account.status === 'archived',
      })),
      recentTransactions: transactions.slice(0, 10).map((transaction) => {
        const visibleAccount = transaction.entries
          .map((entry) => accountById.get(entry.accountId))
          .find((account) => account !== undefined);
        return {
          id: transaction.id,
          date: transaction.effectiveDate,
          description: transaction.description ?? 'Untitled transaction',
          type: transactionTypeForOverview(transaction.kind),
          amount: {
            currency: transaction.currency,
            minorUnits: transaction.amountMinorUnits.toString(),
          },
          accountName: visibleAccount?.name ?? 'Visible account',
          categoryName: null,
        };
      }),
      budgets: [],
      totals: {
        accountBalance: moneyDto(accountBalance),
        budgetRemaining: moneyDto(0n),
        income: moneyDto(income),
        spending: moneyDto(spending),
      },
      hasPartialAccess: false,
    };
  }

  createWorkspace(actor: AuthenticatedActor, body: unknown): WorkspaceResponse {
    const input = bodyRecord(body);
    const workspace = this.store.createWorkspace(
      actor,
      requiredString(input, 'name', 1, 100),
      workspaceKind(input.kind),
    );
    return this.workspaceResponse(workspace);
  }

  getWorkspace(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): WorkspaceResponse {
    return this.workspaceResponse(this.store.getWorkspace(workspaceId, actor));
  }

  listMembers(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly MemberResponse[] {
    return this.store
      .listMembers(workspaceId, actor)
      .map((member) => this.memberResponse(member));
  }

  createInvitation(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): InvitationResponse {
    const input = bodyRecord(body);
    const invitation = this.store.createInvitation(
      workspaceId,
      actor,
      requiredString(input, 'invitedUserId', 1, 200),
      optionalString(input, 'roleId', 100),
    );
    return this.invitationResponse(invitation);
  }

  listInvitations(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly InvitationResponse[] {
    return this.store
      .listInvitations(workspaceId, actor)
      .map((invitation) => this.invitationResponse(invitation));
  }

  acceptInvitation(actor: AuthenticatedActor, token: string): MemberResponse {
    return this.memberResponse(this.store.acceptInvitation(token, actor));
  }

  revokeInvitation(
    actor: AuthenticatedActor,
    workspaceId: string,
    invitationId: string,
  ): InvitationResponse {
    return this.invitationResponse(
      this.store.revokeInvitation(workspaceId, actor, invitationId),
    );
  }

  removeMember(
    actor: AuthenticatedActor,
    workspaceId: string,
    memberId: string,
  ): MemberResponse {
    return this.memberResponse(
      this.store.removeMember(workspaceId, actor, memberId),
    );
  }

  initiateOwnerTransfer(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): OwnerTransferResponse {
    const input = bodyRecord(body);
    return this.ownerTransferResponse(
      this.store.initiateOwnerTransfer(
        workspaceId,
        actor,
        requiredString(input, 'targetMemberId', 1, 100),
      ),
    );
  }

  acceptOwnerTransfer(
    actor: AuthenticatedActor,
    transferId: string,
  ): OwnerTransferResponse {
    return this.ownerTransferResponse(
      this.store.acceptOwnerTransfer(transferId, actor),
    );
  }

  cancelOwnerTransfer(
    actor: AuthenticatedActor,
    workspaceId: string,
    transferId: string,
  ): OwnerTransferResponse {
    return this.ownerTransferResponse(
      this.store.cancelOwnerTransfer(workspaceId, actor, transferId),
    );
  }

  archiveWorkspace(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): WorkspaceResponse {
    return this.workspaceResponse(
      this.store.archiveWorkspace(workspaceId, actor),
    );
  }

  listRoles(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly RoleResponse[] {
    return this.store
      .listRoles(workspaceId, actor)
      .map((role) => this.roleResponse(role));
  }

  createRole(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): RoleResponse {
    const input = bodyRecord(body);
    const role = this.store.createRole(
      workspaceId,
      actor,
      requiredString(input, 'name', 1, 100),
      requiredStringArray(input, 'permissions'),
    );
    return this.roleResponse(role);
  }

  updateRole(
    actor: AuthenticatedActor,
    workspaceId: string,
    roleId: string,
    body: unknown,
  ): RoleResponse {
    const input = bodyRecord(body);
    const role = this.store.updateRole(
      workspaceId,
      actor,
      roleId,
      requiredString(input, 'name', 1, 100),
      requiredStringArray(input, 'permissions'),
    );
    return this.roleResponse(role);
  }

  deleteRole(
    actor: AuthenticatedActor,
    workspaceId: string,
    roleId: string,
  ): { readonly deleted: true } {
    this.store.deleteRole(workspaceId, actor, roleId);
    return { deleted: true };
  }

  assignRole(
    actor: AuthenticatedActor,
    workspaceId: string,
    memberId: string,
    body: unknown,
  ): MemberResponse {
    const input = bodyRecord(body);
    const roleId = requiredString(input, 'roleId', 1, 100);
    return this.memberResponse(
      this.store.assignRole(workspaceId, actor, memberId, roleId),
    );
  }

  updateAccountAccess(
    actor: AuthenticatedActor,
    workspaceId: string,
    accountId: string,
    body: unknown,
  ): AccountResponse {
    const input = bodyRecord(body);
    const memberId = optionalString(input, 'memberId', 100);
    const allowed = input.allowed;
    if (allowed !== undefined && typeof allowed !== 'boolean') {
      throw FinwiseError.validation('allowed must be a boolean.', {
        field: 'allowed',
      });
    }
    const account = this.store.updateAccountAccess(
      workspaceId,
      actor,
      accountId,
      visibilityMode(input.visibilityMode),
      memberId,
      allowed,
    );
    return this.accountResponse(account);
  }

  accessPreview(
    actor: AuthenticatedActor,
    workspaceId: string,
    memberId: string,
  ): {
    readonly member: MemberResponse;
    readonly accounts: readonly AccountResponse[];
  } {
    const member = this.store
      .listMembers(workspaceId, actor)
      .find((candidate) => candidate.id === memberId);
    if (!member) {
      throw FinwiseError.notFound('Workspace member');
    }
    const accounts = this.store
      .listAccounts(workspaceId, {
        userId: member.userId,
        providerIssuer: actor.providerIssuer,
        providerSubject: member.userId,
      })
      .map((account) => this.accountResponse(account));
    return { member: this.memberResponse(member), accounts };
  }

  listAccounts(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly AccountResponse[] {
    return this.store
      .listAccounts(workspaceId, actor)
      .map((account) => this.accountResponse(account));
  }

  createAccount(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): AccountResponse {
    const input = bodyRecord(body);
    const account = this.store.createAccount(
      workspaceId,
      actor,
      requiredString(input, 'name', 1, 100),
      accountKind(input.kind),
      visibilityMode(input.visibilityMode),
    );
    return this.accountResponse(account);
  }

  getAccount(
    actor: AuthenticatedActor,
    workspaceId: string,
    accountId: string,
  ): AccountResponse {
    return this.accountResponse(
      this.store.getAccount(workspaceId, accountId, actor),
    );
  }

  archiveAccount(
    actor: AuthenticatedActor,
    workspaceId: string,
    accountId: string,
  ): AccountResponse {
    return this.accountResponse(
      this.store.archiveAccount(workspaceId, accountId, actor),
    );
  }

  rebuildBalances(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly BalanceProjectionResponse[] {
    return this.store.rebuildBalances(workspaceId, actor).map((projection) => ({
      accountId: projection.accountId,
      balanceMinorUnits: projection.balanceMinorUnits.toString(),
    }));
  }

  postOpeningBalance(
    actor: AuthenticatedActor,
    workspaceId: string,
    accountId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): TransactionResponse {
    const key = requiredIdempotencyKey(idempotencyKey);
    const input = bodyRecord(body);
    const money = parseMoney(input);
    const effectiveDate = parseDate(input.effectiveDate);
    const requestHash = this.store.hashRequest(
      JSON.stringify({
        accountId,
        amount: money.toMinorUnitsString(),
        effectiveDate,
      }),
    );
    const previous = this.store.getIdempotency<TransactionResponse>(
      workspaceId,
      key,
      'account.opening-balance',
      requestHash,
    );
    if (previous !== undefined) {
      return previous;
    }
    const account = this.store.getAccount(workspaceId, accountId, actor);
    const memberId = this.store.memberIdFor(workspaceId, actor.userId);
    const systemAccount = this.store.systemAccount(
      workspaceId,
      'Opening equity',
    );
    const transaction = this.store.postJournal({
      workspaceId,
      kind: 'opening_balance',
      amountMinorUnits: money.minorUnits,
      effectiveDate,
      description: readOptionalString(input, 'description', 500),
      createdByMemberId: memberId,
      entries: [
        {
          accountId: account.id,
          amountMinorUnits: money.minorUnits,
          direction: 'increase',
        },
        {
          accountId: systemAccount.id,
          amountMinorUnits: money.minorUnits,
          direction: 'decrease',
        },
      ],
    });
    const response = this.transactionResponse(transaction);
    this.store.saveIdempotency(
      workspaceId,
      key,
      'account.opening-balance',
      requestHash,
      response,
    );
    return response;
  }

  createTransaction(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): TransactionResponse {
    const key = requiredIdempotencyKey(idempotencyKey);
    const input = bodyRecord(body);
    const type = transactionType(input.type);
    const money = parseMoney(input);
    const effectiveDate = parseDate(input.effectiveDate);
    const sourceAccountId = readAccountId(
      input,
      'accountId',
      'sourceAccountId',
    );
    const destinationAccountId = readOptionalAccountId(
      input,
      'destinationAccountId',
    );
    const requestHash = this.store.hashRequest(
      JSON.stringify({
        type,
        amount: money.toMinorUnitsString(),
        effectiveDate,
        sourceAccountId,
        destinationAccountId,
        description: readOptionalString(input, 'description', 500),
      }),
    );
    const previous = this.store.getIdempotency<TransactionResponse>(
      workspaceId,
      key,
      'transaction.create',
      requestHash,
    );
    if (previous !== undefined) {
      return previous;
    }
    const source = this.store.getAccount(workspaceId, sourceAccountId, actor);
    const memberId = this.store.memberIdFor(workspaceId, actor.userId);
    const entries = this.entriesFor(
      workspaceId,
      actor,
      type,
      source.id,
      destinationAccountId,
      money,
    );
    const transaction = this.store.postJournal({
      workspaceId,
      kind: type,
      amountMinorUnits: money.minorUnits,
      effectiveDate,
      description: readOptionalString(input, 'description', 500),
      createdByMemberId: memberId,
      entries,
    });
    const response = this.transactionResponse(transaction);
    this.store.saveIdempotency(
      workspaceId,
      key,
      'transaction.create',
      requestHash,
      response,
    );
    return response;
  }

  listTransactions(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly TransactionResponse[] {
    return this.store
      .listTransactions(workspaceId, actor)
      .map((transaction) => this.transactionResponse(transaction));
  }

  getTransaction(
    actor: AuthenticatedActor,
    workspaceId: string,
    transactionId: string,
  ): TransactionResponse {
    return this.transactionResponse(
      this.store.getTransaction(workspaceId, transactionId, actor),
    );
  }

  voidTransaction(
    actor: AuthenticatedActor,
    workspaceId: string,
    transactionId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): {
    readonly original: TransactionResponse;
    readonly reversal: TransactionResponse;
  } {
    const key = requiredIdempotencyKey(idempotencyKey);
    const input = bodyRecord(body);
    const reason = requiredString(input, 'reason', 1, 500);
    const effectiveDate = parseDate(input.effectiveDate);
    const requestHash = this.store.hashRequest(
      JSON.stringify({ transactionId, reason, effectiveDate }),
    );
    const previous = this.store.getIdempotency<{
      readonly original: TransactionResponse;
      readonly reversal: TransactionResponse;
    }>(workspaceId, key, 'transaction.void', requestHash);
    if (previous !== undefined) {
      return previous;
    }
    const result = this.store.voidTransaction(
      workspaceId,
      transactionId,
      actor,
      reason,
      effectiveDate,
    );
    const response = {
      original: this.transactionResponse(result.original),
      reversal: this.transactionResponse(result.reversal),
    };
    this.store.saveIdempotency(
      workspaceId,
      key,
      'transaction.void',
      requestHash,
      response,
    );
    return response;
  }

  replaceTransaction(
    actor: AuthenticatedActor,
    workspaceId: string,
    transactionId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): {
    readonly original: TransactionResponse;
    readonly reversal: TransactionResponse;
    readonly replacement: TransactionResponse;
  } {
    const key = requiredIdempotencyKey(idempotencyKey);
    const input = bodyRecord(body);
    const reason = requiredString(input, 'reason', 1, 500);
    const type = transactionType(input.type);
    const money = parseMoney(input);
    const effectiveDate = parseDate(input.effectiveDate);
    const sourceAccountId = readAccountId(
      input,
      'accountId',
      'sourceAccountId',
    );
    const destinationAccountId = readOptionalAccountId(
      input,
      'destinationAccountId',
    );
    const description = readOptionalString(input, 'description', 500);
    const requestHash = this.store.hashRequest(
      JSON.stringify({
        transactionId,
        reason,
        type,
        amount: money.toMinorUnitsString(),
        effectiveDate,
        sourceAccountId,
        destinationAccountId,
        description,
      }),
    );
    const previous = this.store.getIdempotency<{
      readonly original: TransactionResponse;
      readonly reversal: TransactionResponse;
      readonly replacement: TransactionResponse;
    }>(workspaceId, key, 'transaction.replace', requestHash);
    if (previous !== undefined) {
      return previous;
    }
    const source = this.store.getAccount(workspaceId, sourceAccountId, actor);
    const memberId = this.store.memberIdFor(workspaceId, actor.userId);
    const result = this.store.replaceTransaction(
      workspaceId,
      transactionId,
      actor,
      {
        workspaceId,
        kind: type,
        amountMinorUnits: money.minorUnits,
        effectiveDate,
        description,
        createdByMemberId: memberId,
        entries: this.entriesFor(
          workspaceId,
          actor,
          type,
          source.id,
          destinationAccountId,
          money,
        ),
      },
      reason,
      effectiveDate,
    );
    const response = {
      original: this.transactionResponse(result.original),
      reversal: this.transactionResponse(result.reversal),
      replacement: this.transactionResponse(result.replacement),
    };
    this.store.saveIdempotency(
      workspaceId,
      key,
      'transaction.replace',
      requestHash,
      response,
    );
    return response;
  }

  audits(
    actor: AuthenticatedActor,
    workspaceId: string,
    transactionId: string,
  ): readonly unknown[] {
    return this.store
      .getAudits(workspaceId, transactionId, actor)
      .map((audit) => ({
        id: audit.id,
        action: audit.action,
        actorMemberId: audit.actorMemberId,
        details: audit.details,
        createdAt: audit.createdAt.toISOString(),
      }));
  }

  private entriesFor(
    workspaceId: string,
    actor: AuthenticatedActor,
    type: 'income' | 'expense' | 'transfer',
    sourceAccountId: string,
    destinationAccountId: string | undefined,
    money: Money,
  ): JournalDraft['entries'] {
    if (type === 'transfer') {
      if (!destinationAccountId || destinationAccountId === sourceAccountId) {
        throw FinwiseError.validation(
          'A transfer needs two different accounts.',
        );
      }
      this.store.getAccount(workspaceId, destinationAccountId, actor);
      return [
        {
          accountId: sourceAccountId,
          amountMinorUnits: money.minorUnits,
          direction: 'decrease',
        },
        {
          accountId: destinationAccountId,
          amountMinorUnits: money.minorUnits,
          direction: 'increase',
        },
      ];
    }
    if (destinationAccountId) {
      throw FinwiseError.validation(
        'destinationAccountId is only valid for transfers.',
      );
    }
    const systemPurpose = type === 'income' ? 'Income' : 'Expense';
    const systemAccount = this.store.systemAccount(workspaceId, systemPurpose);
    return type === 'income'
      ? [
          {
            accountId: sourceAccountId,
            amountMinorUnits: money.minorUnits,
            direction: 'increase',
          },
          {
            accountId: systemAccount.id,
            amountMinorUnits: money.minorUnits,
            direction: 'decrease',
          },
        ]
      : [
          {
            accountId: sourceAccountId,
            amountMinorUnits: money.minorUnits,
            direction: 'decrease',
          },
          {
            accountId: systemAccount.id,
            amountMinorUnits: money.minorUnits,
            direction: 'increase',
          },
        ];
  }

  private workspaceResponse(
    workspace: BootstrapResult['workspaces'][number],
  ): WorkspaceResponse {
    return {
      id: workspace.id,
      name: workspace.name,
      kind: workspace.kind,
      intent: workspace.kind === 'personal' ? 'PERSONAL' : 'SHARED',
      currency: workspace.defaultCurrency,
      status: workspace.status,
    };
  }

  private accountResponse(account: AccountRecord): AccountResponse {
    return {
      id: account.id,
      workspaceId: account.workspaceId,
      name: account.name,
      kind: account.kind,
      currency: account.currency,
      balanceMinorUnits: account.balanceMinorUnits.toString(),
      visibilityMode: account.visibilityMode,
      status: account.status,
    };
  }

  private roleResponse(role: RoleRecord): RoleResponse {
    return {
      id: role.id,
      workspaceId: role.workspaceId,
      name: role.name,
      protected: role.protected,
      permissions: [...role.permissions].sort(),
    };
  }

  private memberResponse(member: WorkspaceMemberRecord): MemberResponse {
    return {
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      status: member.status,
      isOwner: member.isOwner,
      roleIds: [...member.roleIds],
    };
  }

  private invitationResponse(
    invitation: WorkspaceInvitationRecord,
  ): InvitationResponse {
    return {
      id: invitation.id,
      token: invitation.token,
      workspaceId: invitation.workspaceId,
      invitedUserId: invitation.invitedUserId,
      invitedByMemberId: invitation.invitedByMemberId,
      roleId: invitation.roleId,
      status: invitation.status,
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString(),
    };
  }

  private ownerTransferResponse(
    transfer: OwnerTransferRecord,
  ): OwnerTransferResponse {
    return {
      id: transfer.id,
      workspaceId: transfer.workspaceId,
      fromMemberId: transfer.fromMemberId,
      targetMemberId: transfer.targetMemberId,
      status: transfer.status,
      createdAt: transfer.createdAt.toISOString(),
      expiresAt: transfer.expiresAt.toISOString(),
      acceptedAt: transfer.acceptedAt?.toISOString(),
    };
  }

  private transactionResponse(
    transaction: JournalTransactionRecord,
  ): TransactionResponse {
    return {
      id: transaction.id,
      workspaceId: transaction.workspaceId,
      kind: transaction.kind,
      status: transaction.status,
      amount: {
        currency: transaction.currency,
        minorUnits: transaction.amountMinorUnits.toString(),
      },
      effectiveDate: transaction.effectiveDate,
      recordedAt: transaction.recordedAt.toISOString(),
      description: transaction.description,
      reversalOfId: transaction.reversalOfId,
      entries: transaction.entries.map((entry) => ({
        id: entry.id,
        accountId: entry.accountId,
        amountMinorUnits: entry.amountMinorUnits.toString(),
        direction: entry.direction,
      })),
    };
  }
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw FinwiseError.validation('Request body must be a JSON object.');
  }
  return Object.fromEntries(Object.entries(body));
}

function requiredString(
  input: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): string {
  const value = input[field];
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw FinwiseError.validation(
      `${field} must be between ${min} and ${max} characters.`,
      { field },
    );
  }
  return value.trim();
}

function readOptionalString(
  input: Record<string, unknown>,
  field: string,
  max: number,
): string | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length > max) {
    throw FinwiseError.validation(
      `${field} must be at most ${max} characters.`,
      { field },
    );
  }
  return value.trim() || undefined;
}

function optionalString(
  input: Record<string, unknown>,
  field: string,
  max: number,
): string | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > max
  ) {
    throw FinwiseError.validation(`${field} must be a non-empty string.`, {
      field,
    });
  }
  return value.trim();
}

function requiredStringArray(
  input: Record<string, unknown>,
  field: string,
): readonly string[] {
  const value = input[field];
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some((item) => typeof item !== 'string' || item.trim().length === 0)
  ) {
    throw FinwiseError.validation(
      `${field} must be an array of permission strings.`,
      {
        field,
      },
    );
  }
  return value.map((item) => (item as string).trim());
}

function parseMoney(input: Record<string, unknown>): Money {
  const structured = input.amount;
  if (
    typeof structured === 'object' &&
    structured !== null &&
    !Array.isArray(structured)
  ) {
    const amount = structured as Record<string, unknown>;
    const minorUnits = amount.minorUnits;
    if (typeof minorUnits !== 'string') {
      throw FinwiseError.validation('amount.minorUnits must be a string.', {
        field: 'amount.minorUnits',
      });
    }
    const currency =
      typeof amount.currency === 'string' ? amount.currency : MVP_CURRENCY;
    return Money.fromMinorUnits(minorUnits, currency);
  }
  if (typeof input.amountMinorUnits === 'string') {
    return Money.fromMinorUnits(input.amountMinorUnits, MVP_CURRENCY);
  }
  if (typeof structured === 'string') {
    return Money.fromMinorUnits(structured, MVP_CURRENCY);
  }
  throw FinwiseError.validation(
    'Provide amountMinorUnits or amount { currency, minorUnits }.',
  );
}

function parseDate(value: unknown): string {
  if (value === undefined) {
    return new Date().toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw FinwiseError.validation(
      'effectiveDate must be an ISO date (YYYY-MM-DD).',
      { field: 'effectiveDate' },
    );
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw FinwiseError.validation(
      'effectiveDate is not a valid calendar date.',
      { field: 'effectiveDate' },
    );
  }
  return value;
}

function accountTypeForOverview(
  kind: AccountKind,
): 'CASH' | 'BANK' | 'SAVINGS' | 'OTHER' {
  if (kind === 'cash') return 'CASH';
  if (kind === 'bank') return 'BANK';
  if (kind === 'savings') return 'SAVINGS';
  return 'OTHER';
}

function transactionTypeForOverview(
  kind: JournalKind,
): 'INCOME' | 'EXPENSE' | 'TRANSFER' {
  if (kind === 'income') return 'INCOME';
  if (kind === 'expense') return 'EXPENSE';
  return 'TRANSFER';
}

function moneyDto(minorUnits: bigint): {
  readonly currency: typeof MVP_CURRENCY;
  readonly minorUnits: string;
} {
  return { currency: MVP_CURRENCY, minorUnits: minorUnits.toString() };
}

function readAccountId(
  input: Record<string, unknown>,
  ...fields: string[]
): string {
  for (const field of fields) {
    const value = input[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  throw FinwiseError.validation(`Provide ${fields.join(' or ')}.`, {
    field: fields[0],
  });
}

function readOptionalAccountId(
  input: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw FinwiseError.validation(`${field} must be a non-empty string.`, {
      field,
    });
  }
  return value.trim();
}

function requiredIdempotencyKey(value: string | undefined): string {
  if (!value || value.trim().length < 1 || value.length > 255) {
    throw FinwiseError.idempotencyRequired();
  }
  return value.trim();
}

function transactionType(value: unknown): 'income' | 'expense' | 'transfer' {
  if (value === 'income' || value === 'expense' || value === 'transfer') {
    return value;
  }
  throw FinwiseError.validation('type must be income, expense, or transfer.', {
    field: 'type',
  });
}

function workspaceKind(value: unknown): WorkspaceKind {
  if (value === undefined || value === 'personal') {
    return 'personal';
  }
  if (value === 'family' || value === 'class_fund' || value === 'other') {
    return value;
  }
  throw FinwiseError.validation(
    'kind must be personal, family, class_fund, or other.',
    { field: 'kind' },
  );
}

function accountKind(value: unknown): AccountKind {
  if (
    value === 'cash' ||
    value === 'bank' ||
    value === 'savings' ||
    value === 'investment_cash' ||
    value === 'loan_receivable' ||
    value === 'liability'
  ) {
    return value;
  }
  throw FinwiseError.validation('kind must be a supported user account kind.', {
    field: 'kind',
  });
}

function visibilityMode(value: unknown): AccountVisibilityMode {
  if (value === undefined || value === 'workspace_default') {
    return 'workspace_default';
  }
  if (
    value === 'exclude_selected' ||
    value === 'include_only' ||
    value === 'owner_only'
  ) {
    return value;
  }
  throw FinwiseError.validation('visibilityMode is invalid.', {
    field: 'visibilityMode',
  });
}
