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
});
