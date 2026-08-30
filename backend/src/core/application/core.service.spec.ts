import { CoreService } from './core.service';
import { InMemoryFinwiseStore } from '../infrastructure/in-memory-finwise.store';

const actor = {
  userId: 'dev-user',
  providerIssuer: 'https://local.finwise.dev',
  providerSubject: 'dev-user',
};

describe('CoreService', () => {
  function createService(): CoreService {
    return new CoreService(new InMemoryFinwiseStore());
  }

  it('provisions one personal workspace for repeated bootstrap calls', () => {
    const service = createService();

    const first = service.bootstrap(actor);
    const second = service.bootstrap(actor);

    expect(first.user.id).toBe(second.user.id);
    expect(second.workspaces).toHaveLength(1);
    expect(first.suggestedWorkspaceId).toBe(second.suggestedWorkspaceId);
  });

  it('posts an exact-money expense and replays the same idempotent response', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Bank',
      kind: 'bank',
    });

    const request = {
      type: 'expense',
      accountId: account.id,
      amount: { currency: 'VND', minorUnits: '1250000' },
      effectiveDate: '2026-08-30',
      description: 'Groceries',
    };
    const posted = service.createTransaction(
      actor,
      workspaceId,
      request,
      'cmd-1',
    );
    const replay = service.createTransaction(
      actor,
      workspaceId,
      request,
      'cmd-1',
    );

    expect(posted.id).toBe(replay.id);
    expect(
      service.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('-1250000');
  });

  it('voids a posted transaction through a reversal and restores the balance', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Cash',
      kind: 'cash',
    });
    const posted = service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'income',
        accountId: account.id,
        amountMinorUnits: '500000',
        effectiveDate: '2026-08-30',
      },
      'cmd-income',
    );

    const result = service.voidTransaction(
      actor,
      workspaceId,
      posted.id,
      { reason: 'Correction', effectiveDate: '2026-08-30' },
      'cmd-void',
    );

    expect(result.original.status).toBe('voided');
    expect(result.reversal.reversalOfId).toBe(posted.id);
    expect(
      service.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('0');
  });

  it('returns a permission-filtered overview with exact string totals', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Daily spending',
      kind: 'cash',
    });

    service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'income',
        accountId: account.id,
        amountMinorUnits: '1000000',
        effectiveDate: '2026-08-30',
      },
      'cmd-overview-income',
    );
    service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '250000',
        effectiveDate: '2026-08-30',
      },
      'cmd-overview-expense',
    );

    const overview = service.overview(actor, workspaceId);
    expect(overview.accounts[0]?.balance.minorUnits).toBe('750000');
    expect(overview.totals.income.minorUnits).toBe('1000000');
    expect(overview.totals.spending.minorUnits).toBe('250000');
    expect(overview.recentTransactions).toHaveLength(2);
  });

  it('rejects dates that match the shape but not the calendar', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Cash',
      kind: 'cash',
    });

    expect(() =>
      service.createTransaction(
        actor,
        workspaceId,
        {
          type: 'expense',
          accountId: account.id,
          amountMinorUnits: '1000',
          effectiveDate: '2026-02-31',
        },
        'cmd-invalid-date',
      ),
    ).toThrow('valid calendar date');
  });

  it('protects the owner role while allowing custom role lifecycle', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;

    const ownerRole = service
      .listRoles(actor, workspaceId)
      .find((role) => role.protected);
    expect(ownerRole).toBeDefined();
    expect(ownerRole?.permissions).toContain('role.manage');

    const reviewer = service.createRole(actor, workspaceId, {
      name: 'Reviewer',
      permissions: ['workspace.read', 'transaction.read'],
    });
    expect(reviewer.protected).toBe(false);
    expect(reviewer.permissions).toEqual([
      'transaction.read',
      'workspace.read',
    ]);

    expect(() =>
      service.updateRole(actor, workspaceId, ownerRole?.id ?? '', {
        name: 'Owner 2',
        permissions: [],
      }),
    ).toThrow('protected owner role');
    expect(() =>
      service.deleteRole(actor, workspaceId, ownerRole?.id ?? ''),
    ).toThrow('protected owner role');
    expect(() =>
      service.createRole(actor, workspaceId, {
        name: 'reviewer',
        permissions: ['workspace.read'],
      }),
    ).toThrow('already exists');
  });

  it('keeps owner visibility even when an account is owner-only', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Private cash',
      kind: 'cash',
    });

    service.updateAccountAccess(actor, workspaceId, account.id, {
      visibilityMode: 'owner_only',
    });

    expect(service.listAccounts(actor, workspaceId)).toHaveLength(1);
  });

  it('accepts and removes a workspace invitation with an optional role', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const invitedActor = {
      userId: 'invited-user',
      providerIssuer: 'https://local.finwise.dev',
      providerSubject: 'invited-user',
    };
    const invited = service.bootstrap(invitedActor);
    const role = service.createRole(actor, workspaceId, {
      name: 'Viewer',
      permissions: ['workspace.read'],
    });

    const invitation = service.createInvitation(actor, workspaceId, {
      invitedUserId: invited.user.id,
      roleId: role.id,
    });
    expect(invitation.status).toBe('pending');
    expect(service.listInvitations(actor, workspaceId)).toHaveLength(1);

    const member = service.acceptInvitation(invitedActor, invitation.token);
    expect(member.status).toBe('active');
    expect(member.roleIds).toContain(role.id);
    expect(service.listMembers(actor, workspaceId)).toHaveLength(2);

    expect(() =>
      service.removeMember(actor, workspaceId, member.id),
    ).not.toThrow();
    expect(service.listMembers(actor, workspaceId)).toHaveLength(1);
  });

  it('requires target acceptance and atomically transfers ownership', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const targetActor = {
      userId: 'owner-target',
      providerIssuer: 'https://local.finwise.dev',
      providerSubject: 'owner-target',
    };
    const target = service.bootstrap(targetActor);
    const invitation = service.createInvitation(actor, workspaceId, {
      invitedUserId: target.user.id,
    });
    const targetMember = service.acceptInvitation(
      targetActor,
      invitation.token,
    );

    const transfer = service.initiateOwnerTransfer(actor, workspaceId, {
      targetMemberId: targetMember.id,
    });
    expect(transfer.status).toBe('pending');
    expect(() => service.acceptOwnerTransfer(actor, transfer.id)).toThrow(
      'transfer target',
    );
    const accepted = service.acceptOwnerTransfer(targetActor, transfer.id);
    expect(accepted.status).toBe('accepted');
    expect(
      service
        .listMembers(targetActor, workspaceId)
        .find((member) => member.userId === target.user.id)?.isOwner,
    ).toBe(true);
  });

  it('archives a workspace only through the current owner', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const archived = service.archiveWorkspace(actor, workspaceId);
    expect(archived.status).toBe('archived');
    expect(() =>
      service.createAccount(actor, workspaceId, { name: 'Cash', kind: 'cash' }),
    ).toThrow('Archived workspaces cannot accept financial writes.');
  });

  it('replaces a posted transaction with reversal plus replacement and rebuilds balances', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Cash',
      kind: 'cash',
    });
    const posted = service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'income',
        accountId: account.id,
        amountMinorUnits: '1000000',
        effectiveDate: '2026-08-30',
      },
      'replace-source',
    );

    const result = service.replaceTransaction(
      actor,
      workspaceId,
      posted.id,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '200000',
        effectiveDate: '2026-08-30',
        reason: 'Wrong transaction type',
      },
      'replace-command',
    );
    expect(result.original.status).toBe('voided');
    expect(result.reversal.reversalOfId).toBe(posted.id);
    expect(result.replacement.kind).toBe('expense');
    expect(
      service.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('-200000');
    expect(
      service
        .rebuildBalances(actor, workspaceId)
        .find((projection) => projection.accountId === account.id)
        ?.balanceMinorUnits,
    ).toBe('-200000');

    const replay = service.replaceTransaction(
      actor,
      workspaceId,
      posted.id,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '200000',
        effectiveDate: '2026-08-30',
        reason: 'Wrong transaction type',
      },
      'replace-command',
    );
    expect(replay.replacement.id).toBe(result.replacement.id);
  });

  it('archives an account without deleting its journal history', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Legacy cash',
      kind: 'cash',
    });
    service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'income',
        accountId: account.id,
        amountMinorUnits: '5000',
        effectiveDate: '2026-08-30',
      },
      'archive-history',
    );
    const archived = service.archiveAccount(actor, workspaceId, account.id);
    expect(archived.status).toBe('archived');
    expect(service.listTransactions(actor, workspaceId)).toHaveLength(1);
    expect(() =>
      service.createTransaction(
        actor,
        workspaceId,
        {
          type: 'expense',
          accountId: account.id,
          amountMinorUnits: '1000',
          effectiveDate: '2026-08-30',
        },
        'archive-write',
      ),
    ).toThrow('Archived accounts cannot receive postings.');
  });
});
