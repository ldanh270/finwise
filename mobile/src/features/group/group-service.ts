import type {
  FinwiseApiClient,
  GroupClaimSummary,
  GroupCollectionProgress,
  GroupCollectionSummary,
  GroupDirectExpenseSummary,
  GroupObligationSummary,
  GroupPayableSummary,
  GroupParticipantSummary,
  GroupReportSummary,
  GroupSponsoredExpenseSummary,
  GroupSubmissionSummary,
  GroupReimbursementSummary,
  WorkspaceMemberSummary,
} from "@finwise/api-client";

export function getCollections(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly GroupCollectionSummary[]> {
  return api.getGroupCollections(workspaceId);
}

export function createCollection(
  api: FinwiseApiClient,
  workspaceId: string,
  input: { readonly name: string },
): Promise<GroupCollectionSummary> {
  return api.createGroupCollection(workspaceId, input);
}

export function getReportSummary(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<GroupReportSummary> {
  return api.getGroupReportSummary(workspaceId);
}

export function getParticipants(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly GroupParticipantSummary[]> {
  return api.getGroupParticipants(workspaceId);
}

export function createParticipant(
  api: FinwiseApiClient,
  workspaceId: string,
  input: { readonly memberId: string; readonly displayName: string },
): Promise<GroupParticipantSummary> {
  return api.createGroupParticipant(workspaceId, input);
}

export function getWorkspaceMembers(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly WorkspaceMemberSummary[]> {
  return api.getWorkspaceMembers(workspaceId);
}

export function getClaims(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly GroupClaimSummary[]> {
  return api.getGroupClaims(workspaceId);
}

export function createClaim(
  api: FinwiseApiClient,
  workspaceId: string,
  input: {
    readonly claimantParticipantId: string;
    readonly accountId: string;
    readonly amountMinorUnits: string;
    readonly description: string;
  },
): Promise<GroupClaimSummary> {
  return api.createGroupClaim(workspaceId, input);
}

export function approveClaim(
  api: FinwiseApiClient,
  workspaceId: string,
  claimId: string,
): Promise<GroupClaimSummary> {
  return api.approveGroupClaim(workspaceId, claimId);
}

export function reimburseClaim(
  api: FinwiseApiClient,
  workspaceId: string,
  claimId: string,
  input: {
    readonly payerAccountId: string;
    readonly amountMinorUnits: string;
    readonly effectiveDate?: string;
  },
  idempotencyKey: string,
): Promise<{
  readonly claim: GroupClaimSummary;
  readonly payable: GroupPayableSummary;
  readonly reimbursement: GroupReimbursementSummary;
}> {
  return api.reimburseGroupClaim(workspaceId, claimId, input, idempotencyKey);
}

export function getPayables(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly GroupPayableSummary[]> {
  return api.getGroupPayables(workspaceId);
}

export function getSponsoredExpenses(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly GroupSponsoredExpenseSummary[]> {
  return api.getGroupSponsoredExpenses(workspaceId);
}

export function createSponsoredExpense(
  api: FinwiseApiClient,
  workspaceId: string,
  input: { readonly amountMinorUnits: string; readonly description: string },
): Promise<GroupSponsoredExpenseSummary> {
  return api.createGroupSponsoredExpense(workspaceId, input);
}

export function getDirectExpenses(
  api: FinwiseApiClient,
  workspaceId: string,
): Promise<readonly GroupDirectExpenseSummary[]> {
  return api.getGroupDirectExpenses(workspaceId);
}

export function postDirectExpense(
  api: FinwiseApiClient,
  workspaceId: string,
  input: {
    readonly accountId: string;
    readonly amountMinorUnits: string;
    readonly description: string;
    readonly effectiveDate: string;
  },
  idempotencyKey: string,
): Promise<GroupDirectExpenseSummary> {
  return api.createDirectGroupExpense(workspaceId, input, idempotencyKey);
}

export function getCollectionProgress(
  api: FinwiseApiClient,
  workspaceId: string,
  collectionId: string,
): Promise<GroupCollectionProgress> {
  return api.getGroupCollectionProgress(workspaceId, collectionId);
}

export function getObligations(
  api: FinwiseApiClient,
  workspaceId: string,
  collectionId: string,
): Promise<readonly GroupObligationSummary[]> {
  return api.getGroupObligations(workspaceId, collectionId);
}

export function addObligation(
  api: FinwiseApiClient,
  workspaceId: string,
  collectionId: string,
  input: { readonly participantId: string; readonly amountMinorUnits: string },
): Promise<GroupObligationSummary> {
  return api.addGroupObligation(workspaceId, collectionId, input);
}

export function getSubmissions(
  api: FinwiseApiClient,
  workspaceId: string,
  collectionId: string,
): Promise<readonly GroupSubmissionSummary[]> {
  return api.getGroupSubmissions(workspaceId, collectionId);
}

export function createSubmission(
  api: FinwiseApiClient,
  workspaceId: string,
  collectionId: string,
  input: {
    readonly participantId: string;
    readonly accountId: string;
    readonly amountMinorUnits: string;
  },
): Promise<GroupSubmissionSummary> {
  return api.createGroupSubmission(workspaceId, collectionId, input);
}

export function verifySubmission(
  api: FinwiseApiClient,
  workspaceId: string,
  submissionId: string,
  input?: {
    readonly effectiveDate?: string;
    readonly allocations?: readonly {
      readonly participantId: string;
      readonly amountMinorUnits: string;
    }[];
  },
): Promise<GroupSubmissionSummary> {
  return api.verifyGroupSubmission(workspaceId, submissionId, input);
}

export function resolveOverpayment(
  api: FinwiseApiClient,
  workspaceId: string,
  submissionId: string,
  resolution: "apply_credit" | "adjust_obligation" | "refund",
): Promise<GroupSubmissionSummary> {
  return api.resolveGroupOverpayment(workspaceId, submissionId, resolution);
}
