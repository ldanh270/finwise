import { FinwiseApiClient } from "@finwise/api-client";

describe("shared mobile API client", () => {
  it("refreshes once after a protected request returns 401", async () => {
    let accessToken = "expired";
    let refreshCount = 0;
    const requests: string[] = [];
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      clientType: "mobile",
      getAccessToken: async () => accessToken,
      refreshAccessToken: async () => {
        refreshCount += 1;
        accessToken = "fresh";
        return true;
      },
      fetchImpl: async (_url, init) => {
        requests.push(
          String(
            init?.headers &&
              (init.headers as Record<string, string>).Authorization,
          ),
        );
        if (requests.length === 1)
          return new Response(
            JSON.stringify({ code: "SESSION_EXPIRED", message: "expired" }),
            { status: 401 },
          );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await expect(
      api.get<{ ok: boolean }>("/v1/workspaces/workspace/overview"),
    ).resolves.toEqual({ ok: true });
    expect(refreshCount).toBe(1);
    expect(requests).toEqual(["Bearer expired", "Bearer fresh"]);
  });

  it("keeps a supplied request id across an access-token retry", async () => {
    let requestCount = 0;
    const requestIds: string[] = [];
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      clientType: "mobile",
      getAccessToken: async () => "access-token",
      getRequestId: () => "pilot-request-1",
      refreshAccessToken: async () => true,
      fetchImpl: async (_url, init) => {
        requestCount += 1;
        requestIds.push(
          String(
            init?.headers &&
              (init.headers as Record<string, string>)["X-Request-Id"],
          ),
        );
        if (requestCount === 1) {
          return new Response(
            JSON.stringify({ code: "SESSION_EXPIRED", message: "expired" }),
            { status: 401 },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await expect(
      api.get<{ ok: boolean }>("/v1/workspaces/workspace/overview"),
    ).resolves.toEqual({ ok: true });
    expect(requestIds).toEqual(["pilot-request-1", "pilot-request-1"]);
  });

  it("sends the mobile refresh token in a dedicated header", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      clientType: "mobile",
      getRefreshToken: async () => "refresh-token",
      fetchImpl: async (_url, init) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return new Response(
          JSON.stringify({
            accessToken: "a",
            accessTokenExpiresAt: "2026-09-01T00:00:00Z",
            refreshToken: "next",
            user: { id: "u", email: "u@example.com", displayName: "U" },
          }),
          { status: 200 },
        );
      },
    });

    await api.refresh();
    expect(capturedHeaders?.["X-Finwise-Client"]).toBe("mobile");
    expect(capturedHeaders?.["X-Finwise-Refresh-Token"]).toBe("refresh-token");
  });

  it("maps Group Treasury reimbursement to the protected idempotent command", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    let capturedHeaders: Record<string, string> | undefined;
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      clientType: "mobile",
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        capturedBody = String(init?.body ?? "");
        capturedHeaders = init?.headers as Record<string, string>;
        return new Response(
          JSON.stringify({
            claim: {},
            payable: {},
            reimbursement: {},
          }),
          { status: 200 },
        );
      },
    });

    await api.reimburseGroupClaim(
      "workspace/1",
      "claim/1",
      {
        payerAccountId: "account/1",
        amountMinorUnits: "125000",
        effectiveDate: "2026-09-01",
      },
      "mobile-reimburse-command",
    );

    expect(capturedUrl).toBe(
      "https://api.finwise.test/v1/workspaces/workspace%2F1/group/claims/claim%2F1/reimburse",
    );
    expect(JSON.parse(capturedBody)).toEqual({
      payerAccountId: "account/1",
      amountMinorUnits: "125000",
      effectiveDate: "2026-09-01",
    });
    expect(capturedHeaders?.["X-Finwise-Client"]).toBe("mobile");
    expect(capturedHeaders?.["Idempotency-Key"]).toBe(
      "mobile-reimburse-command",
    );
  });

  it("keeps Group Treasury reads workspace-scoped", async () => {
    let capturedUrl = "";
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test/",
      clientType: "mobile",
      fetchImpl: async (url) => {
        capturedUrl = String(url);
        return new Response("[]", { status: 200 });
      },
    });

    await expect(api.getGroupParticipants("workspace/1")).resolves.toEqual([]);
    expect(capturedUrl).toBe(
      "https://api.finwise.test/v1/workspaces/workspace%2F1/group/participants",
    );
  });

  it("aborts in-flight requests when a workspace scope is cancelled", async () => {
    let requestSignal: AbortSignal | undefined;
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      clientType: "mobile",
      fetchImpl: async (_url, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () =>
            reject(new Error("request aborted")),
          );
        });
      },
    });

    const pending = api.get<{ ok: boolean }>(
      "/v1/workspaces/workspace%2F1/overview",
    );
    await Promise.resolve();
    api.cancelWorkspaceRequests("workspace/1");

    await expect(pending).rejects.toThrow("request aborted");
    expect(requestSignal?.aborted).toBe(true);
  });

  it("covers import matching, raw cleanup, and reconciliation adjustment paths", async () => {
    const requests: Array<{ method: string; url: string; body?: string }> = [];
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      clientType: "mobile",
      fetchImpl: async (url, init) => {
        requests.push({
          method: init?.method ?? "",
          url: String(url),
          body: typeof init?.body === "string" ? init.body : undefined,
        });
        return new Response(JSON.stringify({}), { status: 200 });
      },
    });

    await api.matchImportedRecord("workspace/1", "record/1", "tx/1");
    await api.deleteImportRaw("workspace/1", "session/1");
    await api.adjustReconciliation("workspace/1", "checkpoint/1", {
      amountMinorUnits: "2500",
      reason: "Cash fee",
      effectiveDate: "2026-09-01",
    });

    expect(requests).toEqual([
      {
        method: "POST",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/imports/records/record%2F1/match",
        body: JSON.stringify({ transactionId: "tx/1" }),
      },
      {
        method: "DELETE",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/imports/session%2F1/raw",
      },
      {
        method: "POST",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/reconciliations/checkpoint%2F1/adjust",
        body: JSON.stringify({
          amountMinorUnits: "2500",
          reason: "Cash fee",
          effectiveDate: "2026-09-01",
        }),
      },
    ]);
  });

  it("maps transaction detail, classification, correction, and evidence paths", async () => {
    const requests: Array<{
      method: string;
      url: string;
      body?: string;
      idempotencyKey?: string;
    }> = [];
    const api = new FinwiseApiClient({
      baseUrl: "https://api.finwise.test",
      clientType: "mobile",
      fetchImpl: async (url, init) => {
        const headers = init?.headers as Record<string, string> | undefined;
        requests.push({
          method: init?.method ?? "",
          url: String(url),
          body: typeof init?.body === "string" ? init.body : undefined,
          idempotencyKey: headers?.["Idempotency-Key"],
        });
        return new Response(JSON.stringify([]), { status: 200 });
      },
    });

    await api.getTransaction("workspace/1", "transaction/1");
    await api.getTransactionClassification("workspace/1", "transaction/1");
    await api.classifyTransaction("workspace/1", "transaction/1", {
      lines: [{ budgetId: "budget/1", amountMinorUnits: "1000" }],
    });
    await api.replaceTransaction(
      "workspace/1",
      "transaction/1",
      {
        reason: "Correct account",
        type: "expense",
        amountMinorUnits: "1000",
        accountId: "account/1",
        effectiveDate: "2026-09-02",
      },
      "mobile-replace-command",
    );
    await api.getTransactionAudits("workspace/1", "transaction/1");
    await api.getTransactionSourceLinks("workspace/1", "transaction/1");

    expect(
      requests.map(({ method, url, idempotencyKey }) => ({
        method,
        url,
        idempotencyKey,
      })),
    ).toEqual([
      {
        method: "GET",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/transactions/transaction%2F1",
      },
      {
        method: "GET",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/transactions/transaction%2F1/classification",
      },
      {
        method: "POST",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/transactions/transaction%2F1/classification",
      },
      {
        method: "POST",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/transactions/transaction%2F1/replace",
        idempotencyKey: "mobile-replace-command",
      },
      {
        method: "GET",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/transactions/transaction%2F1/audits",
      },
      {
        method: "GET",
        url: "https://api.finwise.test/v1/workspaces/workspace%2F1/transactions/transaction%2F1/source-links",
      },
    ]);
  });
});
