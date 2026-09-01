import type { ManualDraftCommand, ManualDraftSyncPort } from "./outbox";

/**
 * Minimal shape implemented by the generated API client. Keeping this port
 * structural lets the sync coordinator stay independent from a transport
 * package while production wiring passes `FinwiseApiClient` directly.
 */
export interface ManualTransactionApi {
  postManualTransaction(
    workspaceId: string,
    input: {
      type: "income" | "expense";
      accountId: string;
      amount: { currency: "VND"; minorUnits: string };
      effectiveDate: string;
      description?: string;
    },
    idempotencyKey: string,
  ): Promise<{ readonly id: string }>;
}

export class ApiManualDraftSync implements ManualDraftSyncPort {
  constructor(private readonly api: ManualTransactionApi) {}

  async postManualTransaction(
    command: ManualDraftCommand,
    idempotencyKey: string,
  ): Promise<{ readonly transactionId: string }> {
    const transaction = await this.api.postManualTransaction(
      command.workspaceId,
      {
        type: command.kind,
        accountId: command.accountId,
        amount: command.amount,
        effectiveDate: command.effectiveDate,
        description: command.description,
      },
      idempotencyKey,
    );
    if (!transaction.id.trim()) {
      throw new Error("The API did not return a transaction id");
    }
    return { transactionId: transaction.id };
  }
}
