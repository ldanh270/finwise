import { hydrateStoreState, serializeStoreState } from './runtime-store-state';

interface FixtureRecord {
  readonly amount: bigint;
  readonly occurredAt: Date;
  readonly tags: ReadonlySet<string>;
}

class RuntimeStoreFixture {
  private readonly values = new Map<string, FixtureRecord>();
  private readonly invitations = new Map<string, { readonly token: string }>();
  private readonly invitationsByToken = new Map<
    string,
    { readonly token: string }
  >();

  addValue(): void {
    this.values.set('value-1', {
      amount: 12345678901234567890n,
      occurredAt: new Date('2026-09-01T00:00:00.000Z'),
      tags: new Set(['food', 'home']),
    });
  }

  addInvitation(): void {
    const invitation = { token: 'token-1' };
    this.invitations.set('invitation-1', invitation);
    this.invitationsByToken.set(invitation.token, invitation);
  }

  getValue(): FixtureRecord | undefined {
    return this.values.get('value-1');
  }

  getInvitationByToken(token: string): { readonly token: string } | undefined {
    return this.invitationsByToken.get(token);
  }
}

describe('runtime store state', () => {
  it('round-trips bigint, date, set and map values through JSON', () => {
    const source = new RuntimeStoreFixture();
    source.addValue();

    const jsonCompatibleState = JSON.parse(
      JSON.stringify(serializeStoreState(source)),
    ) as unknown;
    const target = new RuntimeStoreFixture();
    hydrateStoreState(target, jsonCompatibleState);

    expect(target.getValue()).toEqual({
      amount: 12345678901234567890n,
      occurredAt: new Date('2026-09-01T00:00:00.000Z'),
      tags: new Set(['food', 'home']),
    });
  });

  it('rebuilds derived invitation indexes after hydration', () => {
    const source = new RuntimeStoreFixture();
    source.addInvitation();
    const state = JSON.parse(
      JSON.stringify(serializeStoreState(source)),
    ) as unknown;

    const target = new RuntimeStoreFixture();
    hydrateStoreState(target, state);

    expect(target.getInvitationByToken('token-1')).toEqual({
      token: 'token-1',
    });
  });
});
