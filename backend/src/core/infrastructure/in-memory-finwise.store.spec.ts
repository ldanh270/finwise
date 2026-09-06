import { InMemoryFinwiseStore } from './in-memory-finwise.store';

const actor = {
  userId: 'account-owner',
  providerIssuer: 'https://local.finwise.dev',
  providerSubject: 'account-owner',
};

describe('InMemoryFinwiseStore account creation', () => {
  it('creates a currency-specific account with an opening balance and icon', () => {
    const store = new InMemoryFinwiseStore();
    const setup = store.createWorkspaceSetup(actor, {
      name: 'Account workspace',
      kind: 'personal',
      defaultCurrency: 'VND',
      initialAccount: {
        name: 'Cash',
        iconKey: 'cash',
        kind: 'cash',
        currency: 'VND',
        openingBalanceMinorUnits: 0n,
      },
    });

    const account = store.createAccount(
      setup.workspace.id,
      actor,
      'USD Wallet',
      'cash',
      'workspace_default',
      'USD',
      'wallet',
      12500n,
    );

    expect(account.currency).toBe('USD');
    expect(account.iconKey).toBe('wallet');
    expect(
      store.getAccount(setup.workspace.id, account.id, actor).balanceMinorUnits,
    ).toBe(12500n);
  });
});
