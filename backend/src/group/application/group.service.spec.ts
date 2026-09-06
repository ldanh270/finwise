import { CoreService } from '../../core/application/core.service';
import { InMemoryFinwiseStore } from '../../core/infrastructure/in-memory-finwise.store';
import { InMemoryGroupStore } from '../infrastructure/in-memory-group.store';
import { GroupService } from './group.service';

const owner = {
  userId: 'group-owner',
  providerIssuer: 'https://local.finwise.dev',
  providerSubject: 'group-owner',
};
const guest = {
  userId: 'group-guest',
  providerIssuer: 'https://local.finwise.dev',
  providerSubject: 'group-guest',
};

describe('GroupService', () => {
  function createGroupSetup(): {
    readonly core: CoreService;
    readonly group: GroupService;
    readonly workspaceId: string;
    readonly treasuryAccountId: string;
    readonly payerAccountId: string;
    readonly guestParticipantId: string;
    readonly ownerParticipantId: string;
  } {
    const coreStore = new InMemoryFinwiseStore();
    const core = new CoreService(coreStore);
    const ownerBootstrap = core.bootstrap(owner);
    const setup = core.createWorkspace(owner, {
      name: 'Group workspace',
      kind: 'family',
      defaultCurrency: 'VND',
      initialAccount: {
        name: 'Owner cash',
        iconKey: 'cash',
        kind: 'cash',
        currency: 'VND',
        openingBalanceMinorUnits: '0',
      },
    });
    const workspaceId = setup.workspace.id;
    const guestBootstrap = core.bootstrap(guest);
    const invitation = core.createInvitation(owner, workspaceId, {
      invitedUserId: guestBootstrap.user.id,
    });
    const guestMember = core.acceptInvitation(guest, invitation.token);
    const guestRole = core.createRole(owner, workspaceId, {
      name: 'Group operator',
      permissions: [
        'workspace.read',
        'membership.read',
        'account.read',
        'transaction.create',
      ],
    });
    core.assignRole(owner, workspaceId, guestMember.id, {
      roleId: guestRole.id,
    });
    const ownerMember = core
      .listMembers(owner, workspaceId)
      .find((member) => member.userId === ownerBootstrap.user.id);
    if (!ownerMember) throw new Error('Owner member setup failed.');
    const treasury = core.createAccount(owner, workspaceId, {
      name: 'Group treasury',
      kind: 'cash',
    });
    const payer = core.createAccount(owner, workspaceId, {
      name: 'Payer cash',
      kind: 'cash',
    });
    const groupStore = new InMemoryGroupStore(coreStore);
    const guestParticipant = groupStore.createParticipant(
      workspaceId,
      owner,
      guestMember.id,
      'Guest',
    );
    const ownerParticipant = groupStore.createParticipant(
      workspaceId,
      owner,
      ownerMember.id,
      'Owner',
    );
    return {
      core,
      group: new GroupService(groupStore),
      workspaceId,
      treasuryAccountId: treasury.id,
      payerAccountId: payer.id,
      guestParticipantId: guestParticipant.id,
      ownerParticipantId: ownerParticipant.id,
    };
  }

  it('keeps submissions pending until verification then posts once', () => {
    const setup = createGroupSetup();
    const collection = setup.group.createCollection(owner, setup.workspaceId, {
      name: 'Class trip',
    });
    setup.group.addObligation(owner, setup.workspaceId, collection.id, {
      participantId: setup.guestParticipantId,
      amountMinorUnits: '100000',
    });
    const before = setup.core.getAccount(
      owner,
      setup.workspaceId,
      setup.treasuryAccountId,
    ).balanceMinorUnits;
    const submission = setup.group.submitContribution(
      guest,
      setup.workspaceId,
      collection.id,
      {
        participantId: setup.guestParticipantId,
        accountId: setup.treasuryAccountId,
        amountMinorUnits: '100000',
      },
    );
    expect(submission.status).toBe('submitted');
    expect(
      setup.core.getAccount(owner, setup.workspaceId, setup.treasuryAccountId)
        .balanceMinorUnits,
    ).toBe(before);
    const verified = setup.group.verifyContribution(
      owner,
      setup.workspaceId,
      submission.id,
      { effectiveDate: '2026-08-31' },
    );
    expect(verified.status).toBe('verified');
    expect(verified.journalTransactionId).toBeDefined();
    expect(
      setup.core.getAccount(owner, setup.workspaceId, setup.treasuryAccountId)
        .balanceMinorUnits,
    ).toBe('100000');
  });

  it('calculates collection progress from verified obligation payments', () => {
    const setup = createGroupSetup();
    const collection = setup.group.createCollection(owner, setup.workspaceId, {
      name: 'Class trip',
    });
    setup.group.addObligation(owner, setup.workspaceId, collection.id, {
      participantId: setup.guestParticipantId,
      amountMinorUnits: '100000',
    });

    expect(
      setup.group.getCollectionProgress(
        owner,
        setup.workspaceId,
        collection.id,
      ),
    ).toEqual({
      collectionId: collection.id,
      total: { currency: 'VND', minorUnits: '100000' },
      paid: { currency: 'VND', minorUnits: '0' },
      outstanding: { currency: 'VND', minorUnits: '100000' },
      participantCount: 1,
      completedParticipants: 0,
    });

    const submission = setup.group.submitContribution(
      guest,
      setup.workspaceId,
      collection.id,
      {
        participantId: setup.guestParticipantId,
        accountId: setup.treasuryAccountId,
        amountMinorUnits: '60000',
      },
    );
    setup.group.verifyContribution(owner, setup.workspaceId, submission.id, {
      effectiveDate: '2026-08-31',
    });

    expect(
      setup.group.getCollectionProgress(
        owner,
        setup.workspaceId,
        collection.id,
      ),
    ).toMatchObject({
      total: { minorUnits: '100000' },
      paid: { minorUnits: '60000' },
      outstanding: { minorUnits: '40000' },
      participantCount: 1,
      completedParticipants: 0,
    });
  });

  it('allocates one verified receipt across multiple participants atomically', () => {
    const setup = createGroupSetup();
    const collection = setup.group.createCollection(owner, setup.workspaceId, {
      name: 'Shared receipt',
    });
    setup.group.addObligation(owner, setup.workspaceId, collection.id, {
      participantId: setup.guestParticipantId,
      amountMinorUnits: '100000',
    });
    setup.group.addObligation(owner, setup.workspaceId, collection.id, {
      participantId: setup.ownerParticipantId,
      amountMinorUnits: '50000',
    });

    const submission = setup.group.submitContribution(
      guest,
      setup.workspaceId,
      collection.id,
      {
        participantId: setup.guestParticipantId,
        accountId: setup.treasuryAccountId,
        amountMinorUnits: '150000',
      },
    );
    const verified = setup.group.verifyContribution(
      owner,
      setup.workspaceId,
      submission.id,
      {
        effectiveDate: '2026-08-31',
        allocations: [
          {
            participantId: setup.guestParticipantId,
            amountMinorUnits: '100000',
          },
          {
            participantId: setup.ownerParticipantId,
            amountMinorUnits: '50000',
          },
        ],
      },
    );
    expect(verified.status).toBe('verified');
    expect(
      setup.group.getCollectionProgress(
        owner,
        setup.workspaceId,
        collection.id,
      ),
    ).toMatchObject({
      total: { minorUnits: '150000' },
      paid: { minorUnits: '150000' },
      outstanding: { minorUnits: '0' },
      participantCount: 2,
      completedParticipants: 2,
    });
    expect(
      setup.core.getAccount(owner, setup.workspaceId, setup.treasuryAccountId)
        .balanceMinorUnits,
    ).toBe('150000');
  });

  it('posts direct group expenses idempotently and keeps report measures separate', () => {
    const setup = createGroupSetup();
    const collection = setup.group.createCollection(owner, setup.workspaceId, {
      name: 'Report inputs',
    });
    setup.group.addObligation(owner, setup.workspaceId, collection.id, {
      participantId: setup.guestParticipantId,
      amountMinorUnits: '100000',
    });
    setup.group.submitContribution(guest, setup.workspaceId, collection.id, {
      participantId: setup.guestParticipantId,
      accountId: setup.treasuryAccountId,
      amountMinorUnits: '40000',
    });
    setup.group.createSponsoredExpense(guest, setup.workspaceId, {
      amountMinorUnits: '20000',
      description: 'Snacks',
    });
    const claim = setup.group.createClaim(guest, setup.workspaceId, {
      claimantParticipantId: setup.guestParticipantId,
      accountId: setup.treasuryAccountId,
      amountMinorUnits: '50000',
      description: 'Supplies',
    });
    setup.group.approveClaim(owner, setup.workspaceId, claim.id);

    const direct = setup.group.createDirectExpense(
      owner,
      setup.workspaceId,
      {
        accountId: setup.treasuryAccountId,
        amountMinorUnits: '30000',
        description: 'Room booking',
        effectiveDate: '2026-08-31',
      },
      'group-direct-expense-1',
    );
    const replay = setup.group.createDirectExpense(
      owner,
      setup.workspaceId,
      {
        accountId: setup.treasuryAccountId,
        amountMinorUnits: '30000',
        description: 'Room booking',
        effectiveDate: '2026-08-31',
      },
      'group-direct-expense-1',
    );
    expect(replay.id).toBe(direct.id);
    expect(
      setup.core.getAccount(owner, setup.workspaceId, setup.treasuryAccountId)
        .balanceMinorUnits,
    ).toBe('-30000');

    expect(setup.group.reportSummary(owner, setup.workspaceId)).toEqual({
      collectionExpected: { currency: 'VND', minorUnits: '100000' },
      collectionReceived: { currency: 'VND', minorUnits: '0' },
      collectionOutstanding: { currency: 'VND', minorUnits: '100000' },
      directExpense: { currency: 'VND', minorUnits: '30000' },
      approvedClaimExpense: { currency: 'VND', minorUnits: '50000' },
      sponsoredValue: { currency: 'VND', minorUnits: '20000' },
      openPayable: { currency: 'VND', minorUnits: '50000' },
      pendingSubmissionCount: 1,
      pendingSubmissionAmount: { currency: 'VND', minorUnits: '40000' },
    });
  });

  it('requires an explicit decision before posting an overpayment', () => {
    const setup = createGroupSetup();
    const collection = setup.group.createCollection(owner, setup.workspaceId, {
      name: 'Overpayment',
    });
    setup.group.addObligation(owner, setup.workspaceId, collection.id, {
      participantId: setup.guestParticipantId,
      amountMinorUnits: '100000',
    });
    const submission = setup.group.submitContribution(
      guest,
      setup.workspaceId,
      collection.id,
      {
        participantId: setup.guestParticipantId,
        accountId: setup.treasuryAccountId,
        amountMinorUnits: '120000',
      },
    );
    expect(() =>
      setup.group.verifyContribution(owner, setup.workspaceId, submission.id, {
        effectiveDate: '2026-08-31',
      }),
    ).toThrow('user action');
    expect(
      setup.core.getAccount(owner, setup.workspaceId, setup.treasuryAccountId)
        .balanceMinorUnits,
    ).toBe('0');

    const resolved = setup.group.resolveOverpayment(
      owner,
      setup.workspaceId,
      submission.id,
      { resolution: 'apply_credit' },
    );
    expect(resolved.status).toBe('verified');
    expect(resolved.resolution).toBe('apply_credit');
    expect(
      setup.core.getAccount(owner, setup.workspaceId, setup.treasuryAccountId)
        .balanceMinorUnits,
    ).toBe('120000');
    expect(
      setup.group.resolveOverpayment(owner, setup.workspaceId, submission.id, {
        resolution: 'apply_credit',
      }),
    ).toEqual(resolved);
  });

  it('approves a claim only by another member and settles partial reimbursement', () => {
    const setup = createGroupSetup();
    const claim = setup.group.createClaim(guest, setup.workspaceId, {
      claimantParticipantId: setup.guestParticipantId,
      accountId: setup.treasuryAccountId,
      amountMinorUnits: '120000',
      description: 'Supplies',
    });
    expect(() =>
      setup.group.approveClaim(guest, setup.workspaceId, claim.id),
    ).toThrow('claim');
    const approved = setup.group.approveClaim(
      owner,
      setup.workspaceId,
      claim.id,
    );
    expect(approved.status).toBe('approved');
    const first = setup.group.reimburseClaim(
      owner,
      setup.workspaceId,
      claim.id,
      { payerAccountId: setup.payerAccountId, amountMinorUnits: '70000' },
      'group-reimburse-1',
    );
    expect(first.payable.status).toBe('partially_paid');
    const settled = setup.group.reimburseClaim(
      owner,
      setup.workspaceId,
      claim.id,
      { payerAccountId: setup.payerAccountId, amountMinorUnits: '50000' },
      'group-reimburse-2',
    );
    expect(settled.payable.status).toBe('settled');
    expect(settled.claim.status).toBe('paid');
  });

  it('replays a reimbursement without posting a second transfer', () => {
    const setup = createGroupSetup();
    const claim = setup.group.createClaim(guest, setup.workspaceId, {
      claimantParticipantId: setup.guestParticipantId,
      accountId: setup.treasuryAccountId,
      amountMinorUnits: '50000',
      description: 'Supplies',
    });
    setup.group.approveClaim(owner, setup.workspaceId, claim.id);
    const command = {
      payerAccountId: setup.payerAccountId,
      amountMinorUnits: '50000',
      effectiveDate: '2026-08-31',
    };
    const first = setup.group.reimburseClaim(
      owner,
      setup.workspaceId,
      claim.id,
      command,
      'group-reimburse-replay',
    );
    const replay = setup.group.reimburseClaim(
      owner,
      setup.workspaceId,
      claim.id,
      command,
      'group-reimburse-replay',
    );
    expect(replay.reimbursement.journalTransactionId).toBe(
      first.reimbursement.journalTransactionId,
    );
    expect(
      setup.core.getAccount(owner, setup.workspaceId, setup.payerAccountId)
        .balanceMinorUnits,
    ).toBe('-50000');
  });
});
