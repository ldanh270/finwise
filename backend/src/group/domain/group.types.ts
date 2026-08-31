export type ParticipantStatus = 'active' | 'removed';
export type CollectionStatus = 'open' | 'closed';
export type SubmissionStatus =
  'submitted' | 'verified' | 'rejected' | 'needs_user_action';
export type ClaimStatus = 'submitted' | 'approved' | 'rejected' | 'paid';
export type PayableStatus = 'open' | 'partially_paid' | 'settled';
export type ContributionResolution =
  'apply_credit' | 'adjust_obligation' | 'refund';

export interface DirectGroupExpenseRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly amountMinorUnits: bigint;
  readonly description: string;
  readonly journalTransactionId: string;
  readonly createdByMemberId: string;
  readonly createdAt: Date;
}

export interface ParticipantRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly memberId: string;
  displayName: string;
  status: ParticipantStatus;
  readonly createdAt: Date;
}

export interface CollectionRecord {
  readonly id: string;
  readonly workspaceId: string;
  name: string;
  readonly createdByMemberId: string;
  status: CollectionStatus;
  readonly createdAt: Date;
}

export interface ParticipantObligationRecord {
  readonly id: string;
  readonly collectionId: string;
  readonly participantId: string;
  amountMinorUnits: bigint;
  paidMinorUnits: bigint;
}

export interface ContributionSubmissionRecord {
  readonly id: string;
  readonly collectionId: string;
  readonly participantId: string;
  readonly amountMinorUnits: bigint;
  readonly accountId: string;
  readonly submittedByMemberId: string;
  status: SubmissionStatus;
  resolution?: ContributionResolution;
  verifiedByMemberId?: string;
  journalTransactionId?: string;
  readonly createdAt: Date;
}

export interface SponsoredExpenseRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly sponsorMemberId: string;
  readonly amountMinorUnits: bigint;
  readonly description: string;
  status: 'open' | 'reimbursed';
  reimbursedMinorUnits: bigint;
  readonly createdAt: Date;
}

export interface ClaimRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly claimantParticipantId: string;
  readonly accountId: string;
  readonly amountMinorUnits: bigint;
  readonly description: string;
  status: ClaimStatus;
  approvedByMemberId?: string;
  paidMinorUnits: bigint;
  payableId?: string;
  readonly createdAt: Date;
}

export interface PayableRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly claimantParticipantId: string;
  readonly claimId: string;
  readonly amountMinorUnits: bigint;
  paidMinorUnits: bigint;
  status: PayableStatus;
  readonly createdAt: Date;
}

export interface ReimbursementRecord {
  readonly id: string;
  readonly payableId: string;
  readonly accountId: string;
  readonly amountMinorUnits: bigint;
  readonly journalTransactionId: string;
  readonly createdByMemberId: string;
  readonly createdAt: Date;
}
