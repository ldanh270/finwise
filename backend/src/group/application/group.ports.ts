import { AuthenticatedActor } from '../../shared/application/auth';
import { JournalTransactionRecord } from '../../core/domain/ledger.types';
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

export interface GroupLedgerPort {
  memberIdFor(workspaceId: string, userId: string): string;
  accountIdFor(
    workspaceId: string,
    accountId: string,
    actor: AuthenticatedActor,
  ): string;
  systemAccount(workspaceId: string, purpose: string): { readonly id: string };
  postJournal(draft: {
    readonly workspaceId: string;
    readonly kind: 'income' | 'expense' | 'transfer' | 'adjustment';
    readonly amountMinorUnits: bigint;
    readonly effectiveDate: string;
    readonly description?: string;
    readonly createdByMemberId: string;
    readonly entries: readonly {
      readonly accountId: string;
      readonly amountMinorUnits: bigint;
      readonly direction: 'increase' | 'decrease';
    }[];
  }): JournalTransactionRecord;
}

export interface ContributionAllocationDraft {
  readonly participantId: string;
  readonly amountMinorUnits: bigint;
}

export interface GroupStorePort {
  getIdempotency<T extends object>(
    workspaceId: string,
    key: string,
    operation: string,
    requestHash: string,
  ): T | undefined;
  saveIdempotency(
    workspaceId: string,
    key: string,
    operation: string,
    requestHash: string,
    response: object,
  ): void;
  hashRequest(value: string): string;
  listParticipants(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly ParticipantRecord[];
  createParticipant(
    workspaceId: string,
    actor: AuthenticatedActor,
    memberId: string,
    displayName: string,
  ): ParticipantRecord;
  createCollection(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
  ): CollectionRecord;
  listCollections(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly CollectionRecord[];
  addObligation(
    workspaceId: string,
    actor: AuthenticatedActor,
    collectionId: string,
    participantId: string,
    amountMinorUnits: bigint,
  ): ParticipantObligationRecord;
  listObligations(
    workspaceId: string,
    actor: AuthenticatedActor,
    collectionId: string,
  ): readonly ParticipantObligationRecord[];
  submitContribution(
    workspaceId: string,
    actor: AuthenticatedActor,
    collectionId: string,
    participantId: string,
    accountId: string,
    amountMinorUnits: bigint,
  ): ContributionSubmissionRecord;
  listSubmissions(
    workspaceId: string,
    actor: AuthenticatedActor,
    collectionId: string,
  ): readonly ContributionSubmissionRecord[];
  verifyContribution(
    workspaceId: string,
    actor: AuthenticatedActor,
    submissionId: string,
    effectiveDate: string,
    allocations?: readonly ContributionAllocationDraft[],
  ): ContributionSubmissionRecord;
  resolveOverpayment(
    workspaceId: string,
    actor: AuthenticatedActor,
    submissionId: string,
    resolution: ContributionResolution,
  ): ContributionSubmissionRecord;
  createSponsoredExpense(
    workspaceId: string,
    actor: AuthenticatedActor,
    amountMinorUnits: bigint,
    description: string,
  ): SponsoredExpenseRecord;
  listSponsoredExpenses(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly SponsoredExpenseRecord[];
  createClaim(
    workspaceId: string,
    actor: AuthenticatedActor,
    claimantParticipantId: string,
    accountId: string,
    amountMinorUnits: bigint,
    description: string,
  ): ClaimRecord;
  approveClaim(
    workspaceId: string,
    actor: AuthenticatedActor,
    claimId: string,
  ): ClaimRecord;
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
  };
  listClaims(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly ClaimRecord[];
  listPayables(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly PayableRecord[];
  createDirectExpense(
    workspaceId: string,
    actor: AuthenticatedActor,
    accountId: string,
    amountMinorUnits: bigint,
    description: string,
    effectiveDate: string,
  ): DirectGroupExpenseRecord;
  listDirectExpenses(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly DirectGroupExpenseRecord[];
}
