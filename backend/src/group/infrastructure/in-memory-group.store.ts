import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { AuthenticatedActor } from '../../shared/application/auth';
import { FinwiseError } from '../../shared/errors/finwise-error';
import { CoreStorePort } from '../../core/application/core.ports';
import {
  ClaimRecord,
  CollectionRecord,
  ContributionSubmissionRecord,
  ContributionResolution,
  DirectGroupExpenseRecord,
  ParticipantObligationRecord,
  ParticipantRecord,
  PayableRecord,
  ReimbursementRecord,
  SponsoredExpenseRecord,
} from '../domain/group.types';
import { GroupStorePort } from '../application/group.ports';
import { ContributionAllocationDraft } from '../application/group.ports';

export class InMemoryGroupStore implements GroupStorePort {
  private readonly participants = new Map<string, ParticipantRecord>();
  private readonly collections = new Map<string, CollectionRecord>();
  private readonly obligations = new Map<string, ParticipantObligationRecord>();
  private readonly submissions = new Map<
    string,
    ContributionSubmissionRecord
  >();
  private readonly sponsoredExpenses = new Map<
    string,
    SponsoredExpenseRecord
  >();
  private readonly claims = new Map<string, ClaimRecord>();
  private readonly payables = new Map<string, PayableRecord>();
  private readonly reimbursements = new Map<string, ReimbursementRecord>();
  private readonly contributionCredits = new Map<string, bigint>();
  private readonly directExpenses = new Map<string, DirectGroupExpenseRecord>();
  private readonly idempotencies = new Map<
    string,
    {
      readonly operation: string;
      readonly requestHash: string;
      readonly response: object;
    }
  >();

  constructor(private readonly ledger: CoreStorePort) {}

  getIdempotency<T extends object>(
    workspaceId: string,
    key: string,
    operation: string,
    requestHash: string,
  ): T | undefined {
    const record = this.idempotencies.get(`${workspaceId}:${key}`);
    if (!record) return undefined;
    if (record.operation !== operation || record.requestHash !== requestHash) {
      throw FinwiseError.conflict(
        'The idempotency key was reused for another command.',
      );
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
    this.idempotencies.set(`${workspaceId}:${key}`, {
      operation,
      requestHash,
      response,
    });
  }

  hashRequest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  listParticipants(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly ParticipantRecord[] {
    this.requireMember(workspaceId, actor);
    return [...this.participants.values()].filter(
      (participant) =>
        participant.workspaceId === workspaceId &&
        participant.status === 'active',
    );
  }

  createParticipant(
    workspaceId: string,
    actor: AuthenticatedActor,
    memberId: string,
    displayName: string,
  ): ParticipantRecord {
    this.requireMember(workspaceId, actor);
    const member = this.ledger
      .listMembers(workspaceId, actor)
      .find((candidate) => candidate.id === memberId);
    if (!member) throw FinwiseError.notFound('Workspace member');
    const existing = [...this.participants.values()].find(
      (participant) =>
        participant.workspaceId === workspaceId &&
        participant.memberId === memberId &&
        participant.status === 'active',
    );
    if (existing) {
      throw FinwiseError.conflict('The member is already a participant.');
    }
    const participant: ParticipantRecord = {
      id: randomUUID(),
      workspaceId,
      memberId,
      displayName: displayName.trim(),
      status: 'active',
      createdAt: new Date(),
    };
    this.participants.set(participant.id, participant);
    return participant;
  }

  createCollection(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
  ): CollectionRecord {
    const memberId = this.requireMember(workspaceId, actor);
    const collection: CollectionRecord = {
      id: randomUUID(),
      workspaceId,
      name: name.trim(),
      createdByMemberId: memberId,
      status: 'open',
      createdAt: new Date(),
    };
    this.collections.set(collection.id, collection);
    return collection;
  }

  listCollections(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly CollectionRecord[] {
    this.requireMember(workspaceId, actor);
    return [...this.collections.values()]
      .filter((collection) => collection.workspaceId === workspaceId)
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
  }

  addObligation(
    workspaceId: string,
    actor: AuthenticatedActor,
    collectionId: string,
    participantId: string,
    amountMinorUnits: bigint,
  ): ParticipantObligationRecord {
    this.requireMember(workspaceId, actor);
    const collection = this.requireCollection(workspaceId, collectionId);
    if (collection.status !== 'open') {
      throw FinwiseError.businessState(
        'Closed collections cannot change obligations.',
      );
    }
    this.requireParticipant(workspaceId, participantId);
    if (amountMinorUnits <= 0n) {
      throw FinwiseError.validation('Obligation amount must be positive.');
    }
    const duplicate = [...this.obligations.values()].some(
      (obligation) =>
        obligation.collectionId === collectionId &&
        obligation.participantId === participantId,
    );
    if (duplicate) {
      throw FinwiseError.conflict(
        'An obligation already exists for this participant.',
      );
    }
    const obligation: ParticipantObligationRecord = {
      id: randomUUID(),
      collectionId,
      participantId,
      amountMinorUnits,
      paidMinorUnits: 0n,
    };
    this.obligations.set(obligation.id, obligation);
    return obligation;
  }

  listObligations(
    workspaceId: string,
    actor: AuthenticatedActor,
    collectionId: string,
  ): readonly ParticipantObligationRecord[] {
    this.requireMember(workspaceId, actor);
    this.requireCollection(workspaceId, collectionId);
    return [...this.obligations.values()].filter(
      (obligation) => obligation.collectionId === collectionId,
    );
  }

  submitContribution(
    workspaceId: string,
    actor: AuthenticatedActor,
    collectionId: string,
    participantId: string,
    accountId: string,
    amountMinorUnits: bigint,
  ): ContributionSubmissionRecord {
    const memberId = this.requireMember(workspaceId, actor);
    const collection = this.requireCollection(workspaceId, collectionId);
    if (collection.status !== 'open') {
      throw FinwiseError.businessState(
        'Closed collections cannot accept submissions.',
      );
    }
    const participant = this.requireParticipant(workspaceId, participantId);
    if (participant.memberId !== memberId) {
      throw FinwiseError.permission(
        'A participant can only submit their own contribution.',
      );
    }
    this.ledger.getAccount(workspaceId, accountId, actor);
    if (amountMinorUnits <= 0n) {
      throw FinwiseError.validation('Contribution amount must be positive.');
    }
    const submission: ContributionSubmissionRecord = {
      id: randomUUID(),
      collectionId,
      participantId,
      amountMinorUnits,
      accountId,
      submittedByMemberId: memberId,
      status: 'submitted',
      createdAt: new Date(),
    };
    this.submissions.set(submission.id, submission);
    return submission;
  }

  listSubmissions(
    workspaceId: string,
    actor: AuthenticatedActor,
    collectionId: string,
  ): readonly ContributionSubmissionRecord[] {
    this.requireMember(workspaceId, actor);
    this.requireCollection(workspaceId, collectionId);
    return [...this.submissions.values()].filter(
      (submission) => submission.collectionId === collectionId,
    );
  }

  verifyContribution(
    workspaceId: string,
    actor: AuthenticatedActor,
    submissionId: string,
    effectiveDate: string,
    allocations?: readonly ContributionAllocationDraft[],
  ): ContributionSubmissionRecord {
    const reviewerMemberId = this.requireMember(workspaceId, actor);
    const submission = this.submissions.get(submissionId);
    if (!submission || submission.collectionId === '') {
      throw FinwiseError.notFound('Contribution submission');
    }
    const collection = this.requireCollection(
      workspaceId,
      submission.collectionId,
    );
    if (collection.status !== 'open') {
      throw FinwiseError.businessState(
        'Closed collections cannot verify submissions.',
      );
    }
    if (submission.status !== 'submitted') {
      throw FinwiseError.businessState(
        'Only submitted contributions can be verified.',
      );
    }
    const effectiveAllocations = allocations ?? [
      {
        participantId: submission.participantId,
        amountMinorUnits: submission.amountMinorUnits,
      },
    ];
    const allocationTotal = effectiveAllocations.reduce(
      (total, allocation) => total + allocation.amountMinorUnits,
      0n,
    );
    if (allocationTotal !== submission.amountMinorUnits) {
      throw FinwiseError.validation(
        'Contribution allocations must sum exactly to the submission amount.',
      );
    }
    const obligations = effectiveAllocations.map((allocation) => {
      const obligation = [...this.obligations.values()].find(
        (candidate) =>
          candidate.collectionId === submission.collectionId &&
          candidate.participantId === allocation.participantId,
      );
      if (!obligation) throw FinwiseError.notFound('Participant obligation');
      const outstanding =
        obligation.amountMinorUnits - obligation.paidMinorUnits;
      if (allocation.amountMinorUnits > outstanding) {
        return { allocation, obligation, overpaid: true };
      }
      return { allocation, obligation, overpaid: false };
    });
    if (obligations.some((entry) => entry.overpaid)) {
      submission.status = 'needs_user_action';
      throw FinwiseError.businessState(
        'Overpayment needs user action before it can be posted.',
      );
    }
    const memberId = this.ledger.memberIdFor(workspaceId, actor.userId);
    const groupAccount = this.ledger.systemAccount(
      workspaceId,
      `Group collection ${submission.collectionId}`,
    );
    const journal = this.ledger.postJournal({
      workspaceId,
      kind: 'income',
      amountMinorUnits: submission.amountMinorUnits,
      effectiveDate,
      description: `Verified group contribution ${submission.id}`,
      createdByMemberId: memberId,
      entries: [
        {
          accountId: submission.accountId,
          amountMinorUnits: submission.amountMinorUnits,
          direction: 'increase',
        },
        {
          accountId: groupAccount.id,
          amountMinorUnits: submission.amountMinorUnits,
          direction: 'decrease',
        },
      ],
    });
    submission.status = 'verified';
    submission.verifiedByMemberId = reviewerMemberId;
    submission.journalTransactionId = journal.id;
    for (const { allocation, obligation } of obligations) {
      obligation.paidMinorUnits += allocation.amountMinorUnits;
    }
    return submission;
  }

  resolveOverpayment(
    workspaceId: string,
    actor: AuthenticatedActor,
    submissionId: string,
    resolution: ContributionResolution,
  ): ContributionSubmissionRecord {
    const reviewerMemberId = this.requireMember(workspaceId, actor);
    const submission = this.submissions.get(submissionId);
    if (!submission) throw FinwiseError.notFound('Contribution submission');
    const collection = this.requireCollection(
      workspaceId,
      submission.collectionId,
    );
    if (collection.status !== 'open') {
      throw FinwiseError.businessState(
        'Closed collections cannot resolve overpayments.',
      );
    }
    if (submission.status !== 'needs_user_action') {
      if (submission.resolution) return submission;
      throw FinwiseError.businessState(
        'Only overpayments needing user action can be resolved.',
      );
    }
    const obligation = [...this.obligations.values()].find(
      (candidate) =>
        candidate.collectionId === submission.collectionId &&
        candidate.participantId === submission.participantId,
    );
    if (!obligation) throw FinwiseError.notFound('Participant obligation');
    const outstanding = obligation.amountMinorUnits - obligation.paidMinorUnits;
    if (submission.amountMinorUnits <= outstanding) {
      throw FinwiseError.businessState(
        'The submission is no longer an overpayment.',
      );
    }
    const excess = submission.amountMinorUnits - outstanding;
    if (resolution === 'refund') {
      submission.status = 'rejected';
      submission.resolution = resolution;
      return submission;
    }
    const reviewerAccount = this.ledger.getAccount(
      workspaceId,
      submission.accountId,
      actor,
    );
    const groupAccount = this.ledger.systemAccount(
      workspaceId,
      `Group collection ${submission.collectionId}`,
    );
    const journal = this.ledger.postJournal({
      workspaceId,
      kind: 'income',
      amountMinorUnits: submission.amountMinorUnits,
      effectiveDate: new Date().toISOString().slice(0, 10),
      description: `Resolved group contribution ${submission.id}`,
      createdByMemberId: reviewerMemberId,
      entries: [
        {
          accountId: reviewerAccount.id,
          amountMinorUnits: submission.amountMinorUnits,
          direction: 'increase',
        },
        {
          accountId: groupAccount.id,
          amountMinorUnits: submission.amountMinorUnits,
          direction: 'decrease',
        },
      ],
    });
    if (resolution === 'adjust_obligation') {
      obligation.amountMinorUnits += excess;
    } else {
      this.contributionCredits.set(
        submission.id,
        (this.contributionCredits.get(submission.id) ?? 0n) + excess,
      );
    }
    obligation.paidMinorUnits += submission.amountMinorUnits;
    submission.status = 'verified';
    submission.resolution = resolution;
    submission.verifiedByMemberId = reviewerMemberId;
    submission.journalTransactionId = journal.id;
    return submission;
  }

  createSponsoredExpense(
    workspaceId: string,
    actor: AuthenticatedActor,
    amountMinorUnits: bigint,
    description: string,
  ): SponsoredExpenseRecord {
    const sponsorMemberId = this.requireMember(workspaceId, actor);
    if (amountMinorUnits <= 0n) {
      throw FinwiseError.validation(
        'Sponsored expense amount must be positive.',
      );
    }
    const expense: SponsoredExpenseRecord = {
      id: randomUUID(),
      workspaceId,
      sponsorMemberId,
      amountMinorUnits,
      description: description.trim(),
      status: 'open',
      reimbursedMinorUnits: 0n,
      createdAt: new Date(),
    };
    this.sponsoredExpenses.set(expense.id, expense);
    return expense;
  }

  listSponsoredExpenses(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly SponsoredExpenseRecord[] {
    this.requireMember(workspaceId, actor);
    return [...this.sponsoredExpenses.values()].filter(
      (expense) => expense.workspaceId === workspaceId,
    );
  }

  createClaim(
    workspaceId: string,
    actor: AuthenticatedActor,
    claimantParticipantId: string,
    accountId: string,
    amountMinorUnits: bigint,
    description: string,
  ): ClaimRecord {
    const memberId = this.requireMember(workspaceId, actor);
    const claimant = this.requireParticipant(
      workspaceId,
      claimantParticipantId,
    );
    if (claimant.memberId !== memberId) {
      throw FinwiseError.permission(
        'A participant can only submit their own claim.',
      );
    }
    this.ledger.getAccount(workspaceId, accountId, actor);
    if (amountMinorUnits <= 0n) {
      throw FinwiseError.validation('Claim amount must be positive.');
    }
    const claim: ClaimRecord = {
      id: randomUUID(),
      workspaceId,
      claimantParticipantId,
      accountId,
      amountMinorUnits,
      description: description.trim(),
      status: 'submitted',
      paidMinorUnits: 0n,
      createdAt: new Date(),
    };
    this.claims.set(claim.id, claim);
    return claim;
  }

  approveClaim(
    workspaceId: string,
    actor: AuthenticatedActor,
    claimId: string,
  ): ClaimRecord {
    const reviewerMemberId = this.requireMember(workspaceId, actor);
    const claim = this.requireClaim(workspaceId, claimId);
    if (claim.status !== 'submitted') {
      throw FinwiseError.businessState(
        'Only submitted claims can be approved.',
      );
    }
    const claimant = this.requireParticipant(
      workspaceId,
      claim.claimantParticipantId,
    );
    if (claimant.memberId === reviewerMemberId) {
      throw FinwiseError.conflict('A claimant cannot approve their own claim.');
    }
    const payable: PayableRecord = {
      id: randomUUID(),
      workspaceId,
      claimantParticipantId: claim.claimantParticipantId,
      claimId: claim.id,
      amountMinorUnits: claim.amountMinorUnits,
      paidMinorUnits: 0n,
      status: 'open',
      createdAt: new Date(),
    };
    this.payables.set(payable.id, payable);
    claim.status = 'approved';
    claim.approvedByMemberId = reviewerMemberId;
    claim.payableId = payable.id;
    return claim;
  }

  reimburseClaim(
    workspaceId: string,
    actor: AuthenticatedActor,
    claimId: string,
    payerAccountId: string,
    amountMinorUnits: bigint,
    effectiveDate: string,
  ): {
    readonly claim: ClaimRecord;
    readonly payable: PayableRecord;
    readonly reimbursement: ReimbursementRecord;
  } {
    const payerMemberId = this.requireMember(workspaceId, actor);
    const claim = this.requireClaim(workspaceId, claimId);
    if (
      !claim.payableId ||
      (claim.status !== 'approved' && claim.status !== 'paid')
    ) {
      throw FinwiseError.businessState(
        'Claim must be approved before reimbursement.',
      );
    }
    const payable = this.payables.get(claim.payableId);
    if (!payable) throw FinwiseError.notFound('Payable');
    const outstanding = payable.amountMinorUnits - payable.paidMinorUnits;
    if (amountMinorUnits <= 0n || amountMinorUnits > outstanding) {
      throw FinwiseError.validation(
        'Reimbursement must be within the payable outstanding amount.',
      );
    }
    this.ledger.getAccount(workspaceId, payerAccountId, actor);
    this.ledger.getAccount(workspaceId, claim.accountId, actor);
    const journal = this.ledger.postJournal({
      workspaceId,
      kind: 'transfer',
      amountMinorUnits,
      effectiveDate,
      description: `Reimbursement for claim ${claim.id}`,
      createdByMemberId: payerMemberId,
      entries: [
        {
          accountId: payerAccountId,
          amountMinorUnits,
          direction: 'decrease',
        },
        {
          accountId: claim.accountId,
          amountMinorUnits,
          direction: 'increase',
        },
      ],
    });
    payable.paidMinorUnits += amountMinorUnits;
    payable.status =
      payable.paidMinorUnits === payable.amountMinorUnits
        ? 'settled'
        : 'partially_paid';
    claim.paidMinorUnits += amountMinorUnits;
    claim.status = payable.status === 'settled' ? 'paid' : 'approved';
    const reimbursement: ReimbursementRecord = {
      id: randomUUID(),
      payableId: payable.id,
      accountId: payerAccountId,
      amountMinorUnits,
      journalTransactionId: journal.id,
      createdByMemberId: payerMemberId,
      createdAt: new Date(),
    };
    this.reimbursements.set(reimbursement.id, reimbursement);
    return { claim, payable, reimbursement };
  }

  listClaims(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly ClaimRecord[] {
    this.requireMember(workspaceId, actor);
    return [...this.claims.values()].filter(
      (claim) => claim.workspaceId === workspaceId,
    );
  }

  listPayables(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly PayableRecord[] {
    this.requireMember(workspaceId, actor);
    return [...this.payables.values()].filter(
      (payable) => payable.workspaceId === workspaceId,
    );
  }

  createDirectExpense(
    workspaceId: string,
    actor: AuthenticatedActor,
    accountId: string,
    amountMinorUnits: bigint,
    description: string,
    effectiveDate: string,
  ): DirectGroupExpenseRecord {
    const createdByMemberId = this.requireMember(workspaceId, actor);
    if (amountMinorUnits <= 0n) {
      throw FinwiseError.validation('Direct group expense must be positive.');
    }
    const account = this.ledger.getAccount(workspaceId, accountId, actor);
    const expenseAccount = this.ledger.systemAccount(
      workspaceId,
      'Group expense',
    );
    const journal = this.ledger.postJournal({
      workspaceId,
      kind: 'expense',
      amountMinorUnits,
      effectiveDate,
      description: description.trim(),
      createdByMemberId,
      entries: [
        {
          accountId: account.id,
          amountMinorUnits,
          direction: 'decrease',
        },
        {
          accountId: expenseAccount.id,
          amountMinorUnits,
          direction: 'increase',
        },
      ],
    });
    const expense: DirectGroupExpenseRecord = {
      id: randomUUID(),
      workspaceId,
      accountId: account.id,
      amountMinorUnits,
      description: description.trim(),
      journalTransactionId: journal.id,
      createdByMemberId,
      createdAt: new Date(),
    };
    this.directExpenses.set(expense.id, expense);
    return expense;
  }

  listDirectExpenses(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly DirectGroupExpenseRecord[] {
    this.requireMember(workspaceId, actor);
    return [...this.directExpenses.values()]
      .filter(
        (expense) =>
          expense.workspaceId === workspaceId &&
          this.canReadAccount(workspaceId, expense.accountId, actor),
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
  }

  private requireMember(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): string {
    return this.ledger.memberIdFor(workspaceId, actor.userId);
  }

  private canReadAccount(
    workspaceId: string,
    accountId: string,
    actor: AuthenticatedActor,
  ): boolean {
    try {
      this.ledger.getAccount(workspaceId, accountId, actor);
      return true;
    } catch (error: unknown) {
      if (
        error instanceof FinwiseError &&
        error.code === 'RESOURCE_NOT_FOUND'
      ) {
        return false;
      }
      throw error;
    }
  }

  private requireParticipant(
    workspaceId: string,
    participantId: string,
  ): ParticipantRecord {
    const participant = this.participants.get(participantId);
    if (
      !participant ||
      participant.workspaceId !== workspaceId ||
      participant.status !== 'active'
    ) {
      throw FinwiseError.notFound('Participant');
    }
    return participant;
  }

  private requireCollection(
    workspaceId: string,
    collectionId: string,
  ): CollectionRecord {
    const collection = this.collections.get(collectionId);
    if (!collection || collection.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Collection');
    }
    return collection;
  }

  private requireClaim(workspaceId: string, claimId: string): ClaimRecord {
    const claim = this.claims.get(claimId);
    if (!claim || claim.workspaceId !== workspaceId) {
      throw FinwiseError.notFound('Claim');
    }
    return claim;
  }
}
