import { AuthenticatedActor } from '../../shared/application/auth';
import {
  AccountKind,
  AccountRecord,
  AccountVisibilityMode,
  UserRecord,
  JournalKind,
  JournalTransactionRecord,
  TransactionAuditRecord,
  WorkspaceKind,
  WorkspaceRecord,
} from '../domain/ledger.types';

export interface BootstrapResult {
  readonly user: UserRecord;
  readonly workspaces: readonly WorkspaceRecord[];
  readonly suggestedWorkspaceId: string;
}

export interface JournalDraft {
  readonly workspaceId: string;
  readonly kind: JournalKind;
  readonly amountMinorUnits: bigint;
  readonly effectiveDate: string;
  readonly description?: string;
  readonly createdByMemberId: string;
  readonly entries: readonly {
    readonly accountId: string;
    readonly amountMinorUnits: bigint;
    readonly direction: 'increase' | 'decrease';
  }[];
  readonly reversalOfId?: string;
}

export interface CoreStorePort {
  bootstrap(actor: AuthenticatedActor): BootstrapResult;
  createWorkspace(
    actor: AuthenticatedActor,
    name: string,
    kind: WorkspaceKind,
  ): WorkspaceRecord;
  getWorkspace(workspaceId: string, actor: AuthenticatedActor): WorkspaceRecord;
  listAccounts(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly AccountRecord[];
  createAccount(
    workspaceId: string,
    actor: AuthenticatedActor,
    name: string,
    kind: AccountKind,
    visibilityMode: AccountVisibilityMode,
  ): AccountRecord;
  getAccount(
    workspaceId: string,
    accountId: string,
    actor: AuthenticatedActor,
  ): AccountRecord;
  memberIdFor(workspaceId: string, userId: string): string;
  systemAccount(workspaceId: string, purpose: string): AccountRecord;
  postJournal(draft: JournalDraft): JournalTransactionRecord;
  listTransactions(
    workspaceId: string,
    actor: AuthenticatedActor,
  ): readonly JournalTransactionRecord[];
  getTransaction(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
  ): JournalTransactionRecord;
  voidTransaction(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
    reason: string,
    effectiveDate: string,
  ): {
    readonly original: JournalTransactionRecord;
    readonly reversal: JournalTransactionRecord;
  };
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
  getAudits(
    workspaceId: string,
    transactionId: string,
    actor: AuthenticatedActor,
  ): readonly TransactionAuditRecord[];
}
