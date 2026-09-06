import { CoreService } from '../../core/application/core.service';
import { InMemoryFinwiseStore } from '../../core/infrastructure/in-memory-finwise.store';
import { InMemoryImportStore } from '../infrastructure/in-memory-import.store';
import { IngestionService } from './ingestion.service';

const actor = {
  userId: 'import-owner',
  providerIssuer: 'https://local.finwise.dev',
  providerSubject: 'import-owner',
};

describe('IngestionService', () => {
  function createWorkspace(core: CoreService, name: string): string {
    return core.createWorkspace(actor, {
      name,
      kind: 'personal',
      defaultCurrency: 'VND',
      initialAccount: {
        name: 'Opening cash',
        iconKey: 'cash',
        kind: 'cash',
        currency: 'VND',
        openingBalanceMinorUnits: '0',
      },
    }).workspace.id;
  }

  it('deduplicates a CSV session, confirms one row, and reconciles by adjustment', () => {
    const coreStore = new InMemoryFinwiseStore();
    const core = new CoreService(coreStore);
    const workspaceId = createWorkspace(core, 'Import workspace');
    const account = core.createAccount(actor, workspaceId, {
      name: 'Imported bank',
      kind: 'bank',
    });
    const store = new InMemoryImportStore(coreStore);
    const service = new IngestionService(store);
    const csvContent =
      'date,amountMinorUnits,type,description,sourceKey\n' +
      '2026-08-30,1000000,income,Salary,bank-1\n' +
      '2026-08-31,250000,expense,Groceries,bank-2';

    const session = service.createSession(actor, workspaceId, {
      accountId: account.id,
      fileName: 'august.csv',
      csvContent,
    });
    expect(session.duplicate).toBe(false);
    const duplicate = service.createSession(actor, workspaceId, {
      accountId: account.id,
      fileName: 'august-copy.csv',
      csvContent,
    });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.id).toBe(session.id);

    const records = service.listRecords(actor, workspaceId, session.id);
    expect(records).toHaveLength(2);
    expect(
      core.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('0');
    const confirmed = service.confirmRecord(
      actor,
      workspaceId,
      records[0]?.id ?? '',
      'import-confirm-1',
    );
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedTransactionId).toBeDefined();
    expect(
      coreStore.getJournalSourceLinks(
        workspaceId,
        confirmed.confirmedTransactionId ?? '',
        actor,
      ),
    ).toHaveLength(1);
    expect(
      core.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('1000000');
    expect(
      service.confirmRecord(
        actor,
        workspaceId,
        records[0]?.id ?? '',
        'import-confirm-1',
      ).confirmedTransactionId,
    ).toBe(confirmed.confirmedTransactionId);

    const rawAccount = core.createAccount(actor, workspaceId, {
      name: 'Raw retention account',
      kind: 'bank',
    });
    const resolvedSession = service.createSession(actor, workspaceId, {
      accountId: rawAccount.id,
      fileName: 'resolved.csv',
      csvContent:
        'date,amountMinorUnits,type,description,sourceKey\n2026-08-31,1,income,Interest,resolved-1',
    });
    const resolvedRecord = service.listRecords(
      actor,
      workspaceId,
      resolvedSession.id,
    )[0];
    service.confirmRecord(
      actor,
      workspaceId,
      resolvedRecord?.id ?? '',
      'resolved-confirm',
    );
    const deleted = service.deleteRaw(actor, workspaceId, resolvedSession.id);
    expect(deleted.rawDeletedAt).toBeDefined();
    expect(
      service.deleteRaw(actor, workspaceId, resolvedSession.id).rawDeletedAt,
    ).toBe(deleted.rawDeletedAt);

    const checkpoint = service.startReconciliation(actor, workspaceId, {
      accountId: account.id,
      statementDate: '2026-08-31',
      externalBalanceMinorUnits: '1500000',
    });
    expect(checkpoint.difference.minorUnits).toBe('500000');
    expect(service.listReconciliations(actor, workspaceId)).toEqual([
      checkpoint,
    ]);
    const resolved = service.adjustReconciliation(
      actor,
      workspaceId,
      checkpoint.id,
      {
        amountMinorUnits: '500000',
        reason: 'Bank fee reversal',
        effectiveDate: '2026-08-31',
      },
    );
    expect(resolved.status).toBe('resolved');
    expect(
      core.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('1500000');
  });

  it('matches without posting and blocks terminal ignored confirmation', () => {
    const coreStore = new InMemoryFinwiseStore();
    const core = new CoreService(coreStore);
    const workspaceId = createWorkspace(core, 'Match workspace');
    const account = core.createAccount(actor, workspaceId, {
      name: 'Checking',
      kind: 'bank',
    });
    const existing = core.createTransaction(
      actor,
      workspaceId,
      {
        type: 'expense',
        accountId: account.id,
        amountMinorUnits: '250000',
        effectiveDate: '2026-08-31',
      },
      'manual-expense',
    );
    const service = new IngestionService(new InMemoryImportStore(coreStore));
    const session = service.createSession(actor, workspaceId, {
      accountId: account.id,
      fileName: 'match.csv',
      csvContent:
        'date,amountMinorUnits,type,description,sourceKey\n2026-08-31,250000,expense,Groceries,match-1',
    });
    const record = service.listRecords(actor, workspaceId, session.id)[0];
    const matched = service.matchRecord(actor, workspaceId, record?.id ?? '', {
      transactionId: existing.id,
    });
    expect(matched.status).toBe('matched');
    expect(
      core.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('-250000');
    const ignoredSession = service.createSession(actor, workspaceId, {
      accountId: account.id,
      fileName: 'ignored.csv',
      csvContent:
        'date,amountMinorUnits,type,description,sourceKey\n2026-08-31,1000,expense,Noise,ignore-1',
    });
    const ignoredRecord = service.listRecords(
      actor,
      workspaceId,
      ignoredSession.id,
    )[0];
    service.decideRecord(
      actor,
      workspaceId,
      ignoredRecord?.id ?? '',
      'ignored',
      {
        reason: 'Duplicate statement row',
      },
    );
    expect(() =>
      service.confirmRecord(
        actor,
        workspaceId,
        ignoredRecord?.id ?? '',
        'ignored-confirm',
      ),
    ).toThrow('Only reviewable');
  });

  it('bulk confirms valid rows while returning independent row errors', () => {
    const coreStore = new InMemoryFinwiseStore();
    const core = new CoreService(coreStore);
    const workspaceId = createWorkspace(core, 'Bulk workspace');
    const account = core.createAccount(actor, workspaceId, {
      name: 'Bulk import account',
      kind: 'bank',
    });
    const service = new IngestionService(new InMemoryImportStore(coreStore));
    const session = service.createSession(actor, workspaceId, {
      accountId: account.id,
      fileName: 'bulk.csv',
      csvContent:
        'date,amountMinorUnits,type,description,sourceKey\n2026-08-31,1000,income,Salary,bulk-1\n2026-08-31,2000,expense,Food,bulk-2',
    });
    const records = service.listRecords(actor, workspaceId, session.id);
    const result = service.confirmRecords(
      actor,
      workspaceId,
      { recordIds: [records[0]?.id ?? '', 'missing-record'] },
      'bulk-confirm-1',
    );
    expect(result.results[0]?.ok).toBe(true);
    expect(result.results[1]?.ok).toBe(false);
    expect(
      core.getAccount(actor, workspaceId, account.id).balanceMinorUnits,
    ).toBe('1000');
  });
});
