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

  it('exports only policy-visible transactions as escaped CSV', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Daily, cash',
      kind: 'cash',
    });

    service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '125000',
        effectiveDate: '2026-08-30',
        description: 'Lunch, team',
      },
      'cmd-export',
    );

    expect(service.exportTransactions(actor, workspaceId)).toContain(
      'id,date,type,amountMinorUnits,currency,description,accountName,status\r\n',
    );
    expect(service.exportTransactions(actor, workspaceId)).toContain(
      '"Lunch, team","Daily, cash"',
    );
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
    const effectiveDate = `${new Date().toISOString().slice(0, 7)}-01`;

    service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'income',
        accountId: account.id,
        amountMinorUnits: '1000000',
        effectiveDate,
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
        effectiveDate,
      },
      'cmd-overview-expense',
    );

    const overview = service.overview(actor, workspaceId);
    expect(overview.accounts[0]?.balance.minorUnits).toBe('750000');
    expect(overview.totals.income.minorUnits).toBe('1000000');
    expect(overview.totals.spending.minorUnits).toBe('250000');
    expect(overview.recentTransactions).toHaveLength(2);
  });

  it('builds permission-filtered report periods and category totals', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const account = service.createAccount(actor, workspaceId, {
      name: 'Report cash',
      kind: 'cash',
    });
    const category = service.createCategory(actor, workspaceId, {
      name: 'Food',
    });
    const expense = service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '300000',
        effectiveDate: '2026-08-12',
      },
      'cmd-report-expense',
    );
    service.classifyTransaction(actor, workspaceId, expense.id, {
      lines: [
        {
          categoryId: category.id,
          amountMinorUnits: '300000',
          tagIds: [],
        },
      ],
    });
    service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'income',
        accountId: account.id,
        amountMinorUnits: '1000000',
        effectiveDate: '2026-08-01',
      },
      'cmd-report-income',
    );

    const report = service.reports(actor, workspaceId, '2026-08', '2026-08');
    expect(report.totals).toEqual({
      income: { currency: 'VND', minorUnits: '1000000' },
      spending: { currency: 'VND', minorUnits: '300000' },
      net: { currency: 'VND', minorUnits: '700000' },
    });
    expect(report.categories[0]).toEqual({
      categoryId: category.id,
      name: 'Food',
      income: { currency: 'VND', minorUnits: '0' },
      spending: { currency: 'VND', minorUnits: '300000' },
      net: { currency: 'VND', minorUnits: '-300000' },
    });
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
    expect(service.overview(actor, workspaceId).hasPartialAccess).toBe(false);
  });

  it('returns separated balance views and filters hidden accounts for members', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const privateAccount = service.createAccount(actor, workspaceId, {
      name: 'Private cash',
      kind: 'cash',
    });
    service.updateAccountAccess(actor, workspaceId, privateAccount.id, {
      visibilityMode: 'owner_only',
    });
    service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'income',
        accountId: privateAccount.id,
        amountMinorUnits: '450000',
        effectiveDate: '2026-08-30',
      },
      'cmd-balance-view',
    );

    const ownerViews = service.getBalanceViews(actor, workspaceId);
    expect(ownerViews).toEqual([
      {
        accountId: privateAccount.id,
        ledger: { currency: 'VND', minorUnits: '450000' },
        cleared: { currency: 'VND', minorUnits: '450000' },
        reconciled: { currency: 'VND', minorUnits: '450000' },
      },
    ]);

    const invitedActor = {
      userId: 'balance-viewer',
      providerIssuer: 'https://local.finwise.dev',
      providerSubject: 'balance-viewer',
    };
    const invited = service.bootstrap(invitedActor);
    const viewerRole = service.createRole(actor, workspaceId, {
      name: 'Balance viewer',
      permissions: ['account.read', 'transaction.read'],
    });
    const invitation = service.createInvitation(actor, workspaceId, {
      invitedUserId: invited.user.id,
      roleId: viewerRole.id,
    });
    service.acceptInvitation(invitedActor, invitation.token);

    expect(service.getBalanceViews(invitedActor, workspaceId)).toEqual([]);
    expect(service.overview(invitedActor, workspaceId).hasPartialAccess).toBe(
      true,
    );
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

  it('enforces two-level categories and exact immutable transaction splits', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const parent = service.createCategory(actor, workspaceId, { name: 'Food' });
    const groceries = service.createCategory(actor, workspaceId, {
      name: 'Groceries',
      parentId: parent.id,
    });
    const dining = service.createCategory(actor, workspaceId, {
      name: 'Dining',
      parentId: parent.id,
    });
    expect(() =>
      service.createCategory(actor, workspaceId, {
        name: 'Too deep',
        parentId: groceries.id,
      }),
    ).toThrow('at most two levels');
    const tag = service.createTag(actor, workspaceId, { name: 'Essential' });
    const account = service.createAccount(actor, workspaceId, {
      name: 'Cash',
      kind: 'cash',
    });
    const transaction = service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '500000',
        effectiveDate: '2026-08-30',
      },
      'classification-source',
    );
    expect(() =>
      service.classifyTransaction(actor, workspaceId, transaction.id, {
        lines: [{ categoryId: groceries.id, amountMinorUnits: '499999' }],
      }),
    ).toThrow('equal the transaction amount');
    const lines = service.classifyTransaction(
      actor,
      workspaceId,
      transaction.id,
      {
        lines: [
          {
            categoryId: groceries.id,
            amountMinorUnits: '300000',
            tagIds: [tag.id],
          },
          { categoryId: dining.id, amountMinorUnits: '200000' },
        ],
      },
    );
    expect(lines).toHaveLength(2);
    expect(
      service.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('-500000');
    expect(
      service.getClassification(actor, workspaceId, transaction.id),
    ).toHaveLength(2);
  });

  it('calculates a descendant budget from classified expense lines', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const parent = service.createCategory(actor, workspaceId, {
      name: 'Living',
    });
    const child = service.createCategory(actor, workspaceId, {
      name: 'Rent',
      parentId: parent.id,
    });
    const account = service.createAccount(actor, workspaceId, {
      name: 'Bank',
      kind: 'bank',
    });
    const transaction = service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '500000',
        effectiveDate: '2026-08-15',
      },
      'budget-expense',
    );
    service.classifyTransaction(actor, workspaceId, transaction.id, {
      lines: [{ categoryId: child.id, amountMinorUnits: '500000' }],
    });
    service.createBudgetPeriod(actor, workspaceId, {
      month: '2026-08',
      baseMinorUnits: '1000000',
      constraints: [
        {
          categoryId: parent.id,
          mode: 'BY_CHILDREN',
          fixedMinorUnits: '800000',
          rolloverMode: 'NONE',
        },
      ],
    });
    const overview = service.getBudgetOverview(actor, workspaceId, '2026-08');
    expect(overview.constraints[0]?.allocated.minorUnits).toBe('800000');
    expect(overview.constraints[0]?.actual.minorUnits).toBe('500000');
    expect(overview.constraints[0]?.remaining.minorUnits).toBe('300000');
    expect(overview.totals.remaining.minorUnits).toBe('300000');
    expect(
      service.closeBudgetPeriod(actor, workspaceId, '2026-08').status,
    ).toBe('closed');
  });

  it('does not add nested budget constraints twice in period totals', () => {
    const service = createService();
    const workspaceId = service.bootstrap(actor).suggestedWorkspaceId;
    const parent = service.createCategory(actor, workspaceId, {
      name: 'Essentials',
    });
    const rent = service.createCategory(actor, workspaceId, {
      name: 'Rent',
      parentId: parent.id,
    });
    const food = service.createCategory(actor, workspaceId, {
      name: 'Food',
      parentId: parent.id,
    });
    const account = service.createAccount(actor, workspaceId, {
      name: 'Bank',
      kind: 'bank',
    });
    const transaction = service.createTransaction(
      actor,
      workspaceId,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '500000',
        effectiveDate: '2026-08-15',
      },
      'nested-budget-expense',
    );
    service.classifyTransaction(actor, workspaceId, transaction.id, {
      lines: [
        { categoryId: rent.id, amountMinorUnits: '300000' },
        { categoryId: food.id, amountMinorUnits: '200000' },
      ],
    });
    service.createBudgetPeriod(actor, workspaceId, {
      month: '2026-08',
      baseMinorUnits: '1000000',
      constraints: [
        {
          categoryId: parent.id,
          mode: 'BY_CHILDREN',
          fixedMinorUnits: '0',
          rolloverMode: 'NONE',
        },
        {
          categoryId: rent.id,
          mode: 'BY_CHILDREN',
          fixedMinorUnits: '400000',
          rolloverMode: 'NONE',
        },
        {
          categoryId: food.id,
          mode: 'BY_CHILDREN',
          fixedMinorUnits: '300000',
          rolloverMode: 'NONE',
        },
      ],
    });

    const overview = service.getBudgetOverview(actor, workspaceId, '2026-08');
    expect(
      overview.constraints.map((constraint) => constraint.allocated.minorUnits),
    ).toEqual(['700000', '400000', '300000']);
    expect(overview.totals.allocated.minorUnits).toBe('700000');
    expect(overview.totals.actual.minorUnits).toBe('500000');
    expect(overview.totals.remaining.minorUnits).toBe('200000');
  });
});
