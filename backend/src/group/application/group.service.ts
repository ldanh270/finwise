import { AuthenticatedActor } from '../../shared/application/auth';
import { MVP_CURRENCY } from '../../shared/domain/money';
import { FinwiseError } from '../../shared/errors/finwise-error';
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
import { ContributionAllocationDraft, GroupStorePort } from './group.ports';

export interface GroupParticipantResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly memberId: string;
  readonly displayName: string;
  readonly status: string;
}

export interface GroupCollectionResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly createdByMemberId: string;
  readonly status: string;
}

export interface GroupObligationResponse {
  readonly id: string;
  readonly collectionId: string;
  readonly participantId: string;
  readonly amount: MoneyResponse;
  readonly paid: MoneyResponse;
}

export interface GroupCollectionProgressResponse {
  readonly collectionId: string;
  readonly total: MoneyResponse;
  readonly paid: MoneyResponse;
  readonly outstanding: MoneyResponse;
  readonly participantCount: number;
  readonly completedParticipants: number;
}

export interface GroupSubmissionResponse {
  readonly id: string;
  readonly collectionId: string;
  readonly participantId: string;
  readonly amount: MoneyResponse;
  readonly accountId: string;
  readonly status: string;
  readonly resolution?: ContributionResolution;
  readonly journalTransactionId?: string;
}

export interface GroupSponsoredExpenseResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly sponsorMemberId: string;
  readonly amount: MoneyResponse;
  readonly description: string;
  readonly status: string;
  readonly reimbursed: MoneyResponse;
}

export interface GroupClaimResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly claimantParticipantId: string;
  readonly accountId: string;
  readonly amount: MoneyResponse;
  readonly description: string;
  readonly status: string;
  readonly paid: MoneyResponse;
  readonly payableId?: string;
}

export interface GroupPayableResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly claimantParticipantId: string;
  readonly claimId: string;
  readonly amount: MoneyResponse;
  readonly paid: MoneyResponse;
  readonly status: string;
}

export interface GroupReimbursementResponse {
  readonly id: string;
  readonly payableId: string;
  readonly accountId: string;
  readonly amount: MoneyResponse;
  readonly journalTransactionId: string;
}

export interface GroupDirectExpenseResponse {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly amount: MoneyResponse;
  readonly description: string;
  readonly journalTransactionId: string;
  readonly createdByMemberId: string;
  readonly createdAt: string;
}

export interface GroupReportSummaryResponse {
  readonly collectionExpected: MoneyResponse;
  readonly collectionReceived: MoneyResponse;
  readonly collectionOutstanding: MoneyResponse;
  readonly directExpense: MoneyResponse;
  readonly approvedClaimExpense: MoneyResponse;
  readonly sponsoredValue: MoneyResponse;
  readonly openPayable: MoneyResponse;
  readonly pendingSubmissionCount: number;
  readonly pendingSubmissionAmount: MoneyResponse;
}

interface MoneyResponse {
  readonly currency: typeof MVP_CURRENCY;
  readonly minorUnits: string;
}

export class GroupService {
  constructor(private readonly store: GroupStorePort) {}

  listParticipants(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly GroupParticipantResponse[] {
    return this.store
      .listParticipants(workspaceId, actor)
      .map((participant) => this.participantResponse(participant));
  }

  createParticipant(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): GroupParticipantResponse {
    const input = bodyRecord(body);
    return this.participantResponse(
      this.store.createParticipant(
        workspaceId,
        actor,
        requiredString(input, 'memberId', 1, 100),
        requiredString(input, 'displayName', 1, 100),
      ),
    );
  }

  listCollections(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly GroupCollectionResponse[] {
    return this.store
      .listCollections(workspaceId, actor)
      .map((collection) => this.collectionResponse(collection));
  }

  createCollection(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): GroupCollectionResponse {
    const input = bodyRecord(body);
    return this.collectionResponse(
      this.store.createCollection(
        workspaceId,
        actor,
        requiredString(input, 'name', 1, 120),
      ),
    );
  }

  listObligations(
    actor: AuthenticatedActor,
    workspaceId: string,
    collectionId: string,
  ): readonly GroupObligationResponse[] {
    return this.store
      .listObligations(workspaceId, actor, collectionId)
      .map((obligation) => this.obligationResponse(obligation));
  }

  getCollectionProgress(
    actor: AuthenticatedActor,
    workspaceId: string,
    collectionId: string,
  ): GroupCollectionProgressResponse {
    const obligations = this.store.listObligations(
      workspaceId,
      actor,
      collectionId,
    );
    let totalMinorUnits = 0n;
    let paidMinorUnits = 0n;
    let completedParticipants = 0;

    for (const obligation of obligations) {
      totalMinorUnits += obligation.amountMinorUnits;
      paidMinorUnits += obligation.paidMinorUnits;
      if (obligation.paidMinorUnits >= obligation.amountMinorUnits) {
        completedParticipants += 1;
      }
    }

    const outstandingMinorUnits =
      totalMinorUnits > paidMinorUnits ? totalMinorUnits - paidMinorUnits : 0n;
    return {
      collectionId,
      total: moneyResponse(totalMinorUnits),
      paid: moneyResponse(paidMinorUnits),
      outstanding: moneyResponse(outstandingMinorUnits),
      participantCount: obligations.length,
      completedParticipants,
    };
  }

  addObligation(
    actor: AuthenticatedActor,
    workspaceId: string,
    collectionId: string,
    body: unknown,
  ): GroupObligationResponse {
    const input = bodyRecord(body);
    return this.obligationResponse(
      this.store.addObligation(
        workspaceId,
        actor,
        collectionId,
        requiredString(input, 'participantId', 1, 100),
        requiredPositiveMinorUnits(input.amountMinorUnits, 'amountMinorUnits'),
      ),
    );
  }

  listSubmissions(
    actor: AuthenticatedActor,
    workspaceId: string,
    collectionId: string,
  ): readonly GroupSubmissionResponse[] {
    return this.store
      .listSubmissions(workspaceId, actor, collectionId)
      .map((submission) => this.submissionResponse(submission));
  }

  submitContribution(
    actor: AuthenticatedActor,
    workspaceId: string,
    collectionId: string,
    body: unknown,
  ): GroupSubmissionResponse {
    const input = bodyRecord(body);
    return this.submissionResponse(
      this.store.submitContribution(
        workspaceId,
        actor,
        collectionId,
        requiredString(input, 'participantId', 1, 100),
        requiredString(input, 'accountId', 1, 100),
        requiredPositiveMinorUnits(input.amountMinorUnits, 'amountMinorUnits'),
      ),
    );
  }

  verifyContribution(
    actor: AuthenticatedActor,
    workspaceId: string,
    submissionId: string,
    body: unknown,
  ): GroupSubmissionResponse {
    const input = bodyRecord(body);
    const allocations = readAllocations(input.allocations);
    return this.submissionResponse(
      this.store.verifyContribution(
        workspaceId,
        actor,
        submissionId,
        readDate(input.effectiveDate),
        allocations,
      ),
    );
  }

  resolveOverpayment(
    actor: AuthenticatedActor,
    workspaceId: string,
    submissionId: string,
    body: unknown,
  ): GroupSubmissionResponse {
    const input = bodyRecord(body);
    const resolution = contributionResolution(input.resolution);
    return this.submissionResponse(
      this.store.resolveOverpayment(
        workspaceId,
        actor,
        submissionId,
        resolution,
      ),
    );
  }

  listSponsoredExpenses(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly GroupSponsoredExpenseResponse[] {
    return this.store
      .listSponsoredExpenses(workspaceId, actor)
      .map((expense) => this.sponsoredExpenseResponse(expense));
  }

  createSponsoredExpense(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): GroupSponsoredExpenseResponse {
    const input = bodyRecord(body);
    return this.sponsoredExpenseResponse(
      this.store.createSponsoredExpense(
        workspaceId,
        actor,
        requiredPositiveMinorUnits(input.amountMinorUnits, 'amountMinorUnits'),
        requiredString(input, 'description', 1, 500),
      ),
    );
  }

  listClaims(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly GroupClaimResponse[] {
    return this.store
      .listClaims(workspaceId, actor)
      .map((claim) => this.claimResponse(claim));
  }

  createClaim(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
  ): GroupClaimResponse {
    const input = bodyRecord(body);
    return this.claimResponse(
      this.store.createClaim(
        workspaceId,
        actor,
        requiredString(input, 'claimantParticipantId', 1, 100),
        requiredString(input, 'accountId', 1, 100),
        requiredPositiveMinorUnits(input.amountMinorUnits, 'amountMinorUnits'),
        requiredString(input, 'description', 1, 500),
      ),
    );
  }

  approveClaim(
    actor: AuthenticatedActor,
    workspaceId: string,
    claimId: string,
  ): GroupClaimResponse {
    return this.claimResponse(
      this.store.approveClaim(workspaceId, actor, claimId),
    );
  }

  reimburseClaim(
    actor: AuthenticatedActor,
    workspaceId: string,
    claimId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): {
    readonly claim: GroupClaimResponse;
    readonly payable: GroupPayableResponse;
    readonly reimbursement: GroupReimbursementResponse;
  } {
    const input = bodyRecord(body);
    const key = requiredIdempotencyKey(idempotencyKey);
    const payerAccountId = requiredString(input, 'payerAccountId', 1, 100);
    const amountMinorUnits = requiredPositiveMinorUnits(
      input.amountMinorUnits,
      'amountMinorUnits',
    );
    const effectiveDate = readDate(input.effectiveDate);
    const requestHash = this.store.hashRequest(
      JSON.stringify({
        claimId,
        payerAccountId,
        amountMinorUnits: amountMinorUnits.toString(),
        effectiveDate,
      }),
    );
    const previous = this.store.getIdempotency<{
      readonly claim: GroupClaimResponse;
      readonly payable: GroupPayableResponse;
      readonly reimbursement: GroupReimbursementResponse;
    }>(workspaceId, key, 'group.claim.reimburse', requestHash);
    if (previous) return previous;
    const result = this.store.reimburseClaim(
      workspaceId,
      actor,
      claimId,
      payerAccountId,
      amountMinorUnits,
      effectiveDate,
    );
    const response = {
      claim: this.claimResponse(result.claim),
      payable: this.payableResponse(result.payable),
      reimbursement: this.reimbursementResponse(result.reimbursement),
    };
    this.store.saveIdempotency(
      workspaceId,
      key,
      'group.claim.reimburse',
      requestHash,
      response,
    );
    return response;
  }

  listPayables(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly GroupPayableResponse[] {
    return this.store
      .listPayables(workspaceId, actor)
      .map((payable) => this.payableResponse(payable));
  }

  createDirectExpense(
    actor: AuthenticatedActor,
    workspaceId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): GroupDirectExpenseResponse {
    const input = bodyRecord(body);
    const key = requiredIdempotencyKey(idempotencyKey);
    const accountId = requiredString(input, 'accountId', 1, 100);
    const amountMinorUnits = requiredPositiveMinorUnits(
      input.amountMinorUnits,
      'amountMinorUnits',
    );
    const description = requiredString(input, 'description', 1, 500);
    const effectiveDate = readDate(input.effectiveDate);
    const requestHash = this.store.hashRequest(
      JSON.stringify({
        accountId,
        amountMinorUnits: amountMinorUnits.toString(),
        description,
        effectiveDate,
      }),
    );
    const previous = this.store.getIdempotency<GroupDirectExpenseResponse>(
      workspaceId,
      key,
      'group.direct-expense.create',
      requestHash,
    );
    if (previous) return previous;
    const response = this.directExpenseResponse(
      this.store.createDirectExpense(
        workspaceId,
        actor,
        accountId,
        amountMinorUnits,
        description,
        effectiveDate,
      ),
    );
    this.store.saveIdempotency(
      workspaceId,
      key,
      'group.direct-expense.create',
      requestHash,
      response,
    );
    return response;
  }

  listDirectExpenses(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): readonly GroupDirectExpenseResponse[] {
    return this.store
      .listDirectExpenses(workspaceId, actor)
      .map((expense) => this.directExpenseResponse(expense));
  }

  reportSummary(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): GroupReportSummaryResponse {
    const collections = this.store.listCollections(workspaceId, actor);
    const obligations = collections.flatMap((collection) =>
      this.store.listObligations(workspaceId, actor, collection.id),
    );
    const submissions = collections.flatMap((collection) =>
      this.store.listSubmissions(workspaceId, actor, collection.id),
    );
    const directExpenses = this.store.listDirectExpenses(workspaceId, actor);
    const claims = this.store.listClaims(workspaceId, actor);
    const payables = this.store.listPayables(workspaceId, actor);
    const sponsoredExpenses = this.store.listSponsoredExpenses(
      workspaceId,
      actor,
    );
    const collectionExpected = sumBigints(
      obligations.map((obligation) => obligation.amountMinorUnits),
    );
    const collectionReceived = sumBigints(
      obligations.map((obligation) => obligation.paidMinorUnits),
    );
    const pendingSubmissions = submissions.filter(
      (submission) => submission.status === 'submitted',
    );
    const approvedClaims = claims.filter(
      (claim) => claim.status === 'approved' || claim.status === 'paid',
    );
    const openPayables = payables.filter(
      (payable) => payable.status !== 'settled',
    );
    return {
      collectionExpected: moneyResponse(collectionExpected),
      collectionReceived: moneyResponse(collectionReceived),
      collectionOutstanding: moneyResponse(
        collectionExpected > collectionReceived
          ? collectionExpected - collectionReceived
          : 0n,
      ),
      directExpense: moneyResponse(
        sumBigints(directExpenses.map((expense) => expense.amountMinorUnits)),
      ),
      approvedClaimExpense: moneyResponse(
        sumBigints(approvedClaims.map((claim) => claim.amountMinorUnits)),
      ),
      sponsoredValue: moneyResponse(
        sumBigints(
          sponsoredExpenses.map((expense) => expense.amountMinorUnits),
        ),
      ),
      openPayable: moneyResponse(
        sumBigints(
          openPayables.map(
            (payable) => payable.amountMinorUnits - payable.paidMinorUnits,
          ),
        ),
      ),
      pendingSubmissionCount: pendingSubmissions.length,
      pendingSubmissionAmount: moneyResponse(
        sumBigints(
          pendingSubmissions.map((submission) => submission.amountMinorUnits),
        ),
      ),
    };
  }

  private participantResponse(
    participant: ParticipantRecord,
  ): GroupParticipantResponse {
    return {
      id: participant.id,
      workspaceId: participant.workspaceId,
      memberId: participant.memberId,
      displayName: participant.displayName,
      status: participant.status,
    };
  }

  private collectionResponse(
    collection: CollectionRecord,
  ): GroupCollectionResponse {
    return {
      id: collection.id,
      workspaceId: collection.workspaceId,
      name: collection.name,
      createdByMemberId: collection.createdByMemberId,
      status: collection.status,
    };
  }

  private obligationResponse(
    obligation: ParticipantObligationRecord,
  ): GroupObligationResponse {
    return {
      id: obligation.id,
      collectionId: obligation.collectionId,
      participantId: obligation.participantId,
      amount: moneyResponse(obligation.amountMinorUnits),
      paid: moneyResponse(obligation.paidMinorUnits),
    };
  }

  private submissionResponse(
    submission: ContributionSubmissionRecord,
  ): GroupSubmissionResponse {
    return {
      id: submission.id,
      collectionId: submission.collectionId,
      participantId: submission.participantId,
      amount: moneyResponse(submission.amountMinorUnits),
      accountId: submission.accountId,
      status: submission.status,
      resolution: submission.resolution,
      journalTransactionId: submission.journalTransactionId,
    };
  }

  private sponsoredExpenseResponse(
    expense: SponsoredExpenseRecord,
  ): GroupSponsoredExpenseResponse {
    return {
      id: expense.id,
      workspaceId: expense.workspaceId,
      sponsorMemberId: expense.sponsorMemberId,
      amount: moneyResponse(expense.amountMinorUnits),
      description: expense.description,
      status: expense.status,
      reimbursed: moneyResponse(expense.reimbursedMinorUnits),
    };
  }

  private claimResponse(claim: ClaimRecord): GroupClaimResponse {
    return {
      id: claim.id,
      workspaceId: claim.workspaceId,
      claimantParticipantId: claim.claimantParticipantId,
      accountId: claim.accountId,
      amount: moneyResponse(claim.amountMinorUnits),
      description: claim.description,
      status: claim.status,
      paid: moneyResponse(claim.paidMinorUnits),
      payableId: claim.payableId,
    };
  }

  private payableResponse(payable: PayableRecord): GroupPayableResponse {
    return {
      id: payable.id,
      workspaceId: payable.workspaceId,
      claimantParticipantId: payable.claimantParticipantId,
      claimId: payable.claimId,
      amount: moneyResponse(payable.amountMinorUnits),
      paid: moneyResponse(payable.paidMinorUnits),
      status: payable.status,
    };
  }

  private reimbursementResponse(
    reimbursement: ReimbursementRecord,
  ): GroupReimbursementResponse {
    return {
      id: reimbursement.id,
      payableId: reimbursement.payableId,
      accountId: reimbursement.accountId,
      amount: moneyResponse(reimbursement.amountMinorUnits),
      journalTransactionId: reimbursement.journalTransactionId,
    };
  }

  private directExpenseResponse(
    expense: DirectGroupExpenseRecord,
  ): GroupDirectExpenseResponse {
    return {
      id: expense.id,
      workspaceId: expense.workspaceId,
      accountId: expense.accountId,
      amount: moneyResponse(expense.amountMinorUnits),
      description: expense.description,
      journalTransactionId: expense.journalTransactionId,
      createdByMemberId: expense.createdByMemberId,
      createdAt: expense.createdAt.toISOString(),
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

function requiredPositiveMinorUnits(value: unknown, field: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw FinwiseError.validation(`${field} must be a minor-unit string.`, {
      field,
    });
  }
  const parsed = BigInt(value);
  if (parsed <= 0n) {
    throw FinwiseError.validation(`${field} must be greater than zero.`, {
      field,
    });
  }
  return parsed;
}

function readAllocations(
  value: unknown,
): readonly ContributionAllocationDraft[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw FinwiseError.validation(
      'allocations must be a non-empty array when provided.',
      { field: 'allocations' },
    );
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw FinwiseError.validation('Each allocation must be an object.', {
        field: `allocations[${index}]`,
      });
    }
    const allocation = Object.fromEntries(Object.entries(entry));
    return {
      participantId: requiredString(allocation, 'participantId', 1, 100),
      amountMinorUnits: requiredPositiveMinorUnits(
        allocation.amountMinorUnits,
        `allocations[${index}].amountMinorUnits`,
      ),
    };
  });
}

function contributionResolution(value: unknown): ContributionResolution {
  if (
    value === 'apply_credit' ||
    value === 'adjust_obligation' ||
    value === 'refund'
  ) {
    return value;
  }
  throw FinwiseError.validation(
    'resolution must be apply_credit, adjust_obligation, or refund.',
    { field: 'resolution' },
  );
}

function readDate(value: unknown): string {
  if (value === undefined) return new Date().toISOString().slice(0, 10);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw FinwiseError.validation('effectiveDate must be YYYY-MM-DD.', {
      field: 'effectiveDate',
    });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== value) {
    throw FinwiseError.validation(
      'effectiveDate is not a valid calendar date.',
      {
        field: 'effectiveDate',
      },
    );
  }
  return value;
}

function moneyResponse(minorUnits: bigint): MoneyResponse {
  return { currency: MVP_CURRENCY, minorUnits: minorUnits.toString() };
}

function sumBigints(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

function requiredIdempotencyKey(value: string | undefined): string {
  if (!value || value.trim().length < 1 || value.length > 255) {
    throw FinwiseError.validation('Idempotency-Key is required.');
  }
  return value.trim();
}
