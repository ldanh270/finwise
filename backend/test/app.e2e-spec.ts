import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

describe('Finwise API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes health without authentication', async () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect({ status: 'ok', service: 'finwise-api' });
  });

  it('exposes liveness and reports missing readiness dependencies safely', async () => {
    await request(app.getHttpServer())
      .get('/v1/health/live')
      .expect(200)
      .expect((healthResponse) => {
        const body = healthResponse.body as {
          readonly status: string;
          readonly version: string;
        };
        expect(body.status).toBe('ok');
        expect(body.version).toBeDefined();
      });
    await request(app.getHttpServer())
      .get('/v1/health/ready')
      .expect(503)
      .expect((healthResponse) => {
        const body = healthResponse.body as {
          readonly status: string;
          readonly checks: { readonly database: string };
        };
        expect(body.status).toBe('not_ready');
        expect(body.checks.database).toBe('failed');
      });
  });

  it('bootstraps a dev identity and creates a workspace setup', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/session/bootstrap')
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200);

    const body = response.body as {
      readonly user: { readonly id: string };
      readonly workspaces: readonly { readonly id: string }[];
      readonly suggestedWorkspaceId: string;
    };

    expect(body.user.id).toEqual(expect.any(String));
    expect(body.workspaces).toHaveLength(0);
    expect(body.suggestedWorkspaceId).toBe('');

    const setupResponse = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('x-finwise-user-id', 'e2e-user')
      .send({
        name: 'E2E Home',
        kind: 'personal',
        defaultCurrency: 'VND',
        initialAccount: {
          name: 'Cash',
          iconKey: 'cash',
          kind: 'cash',
          currency: 'VND',
          openingBalanceMinorUnits: '0',
        },
      })
      .expect(201);
    const setup = setupResponse.body as {
      readonly workspace: { readonly id: string };
      readonly account: { readonly id: string };
      readonly budgets: readonly { readonly name: string }[];
    };
    const workspaceId = setup.workspace.id;
    const account = setup.account;
    expect(setup.budgets.map((budget) => budget.name)).toEqual([
      'Food',
      'Shopping',
      'Education',
      'Transport',
      'Housing',
      'Health',
      'Bills',
      'Other',
    ]);

    await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspaceId}/overview`)
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200)
      .expect((overviewResponse) => {
        const overview = overviewResponse.body as {
          readonly workspaceId: string;
          readonly accounts: readonly unknown[];
          readonly recentTransactions: readonly unknown[];
        };
        expect(overview.workspaceId).toBe(workspaceId);
        expect(overview.accounts).toHaveLength(1);
        expect(overview.recentTransactions).toHaveLength(0);
      });

    const roleResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/roles`)
      .set('x-finwise-user-id', 'e2e-user')
      .send({ name: 'Reviewer', permissions: ['workspace.read'] })
      .expect(201);
    expect((roleResponse.body as { readonly name: string }).name).toBe(
      'Reviewer',
    );

    const rolesResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspaceId}/roles`)
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200);
    expect(rolesResponse.body as readonly unknown[]).toHaveLength(2);

    const membersResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspaceId}/members`)
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200);
    const members = membersResponse.body as readonly {
      readonly id: string;
      readonly isOwner: boolean;
    }[];
    expect(members).toHaveLength(1);
    expect(members[0]?.isOwner).toBe(true);

    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/accounts/${account.id}/access`)
      .set('x-finwise-user-id', 'e2e-user')
      .send({ visibilityMode: 'owner_only' })
      .expect(201);

    await request(app.getHttpServer())
      .get(
        `/v1/workspaces/${workspaceId}/members/${members[0]?.id}/access-preview`,
      )
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200)
      .expect((previewResponse) => {
        const preview = previewResponse.body as {
          readonly accounts: readonly unknown[];
        };
        expect(preview.accounts).toHaveLength(1);
      });

    const invitedBootstrap = await request(app.getHttpServer())
      .get('/v1/session/bootstrap')
      .set('x-finwise-user-id', 'e2e-invited-user')
      .expect(200);
    const invitedUserId = (invitedBootstrap.body as { user: { id: string } })
      .user.id;
    const invitationResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/invitations`)
      .set('x-finwise-user-id', 'e2e-user')
      .send({ invitedUserId })
      .expect(201);
    const invitation = invitationResponse.body as {
      readonly token: string;
    };

    await request(app.getHttpServer())
      .post(`/v1/invitations/${invitation.token}/accept`)
      .set('x-finwise-user-id', 'e2e-invited-user')
      .expect(201);

    const membersAfterInvite = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspaceId}/members`)
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200);
    const invitedMember = (
      membersAfterInvite.body as readonly { id: string; userId: string }[]
    ).find((member) => member.userId === invitedUserId);
    expect(invitedMember).toBeDefined();

    const transferResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/owner-transfers`)
      .set('x-finwise-user-id', 'e2e-user')
      .send({ targetMemberId: invitedMember?.id })
      .expect(201);
    const transfer = transferResponse.body as { readonly id: string };
    await request(app.getHttpServer())
      .post(`/v1/owner-transfers/${transfer.id}/accept`)
      .set('x-finwise-user-id', 'e2e-invited-user')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/archive`)
      .set('x-finwise-user-id', 'e2e-invited-user')
      .expect(201);
  });

  it('runs the account, transaction, planning, group, import and reconciliation journey', async () => {
    const authHeader = { 'x-finwise-user-id': 'e2e-command-journey' };
    const bootstrapResponse = await request(app.getHttpServer())
      .get('/v1/session/bootstrap')
      .set(authHeader)
      .expect(200);
    const bootstrap = bootstrapResponse.body as {
      readonly suggestedWorkspaceId: string;
    };
    expect(bootstrap.suggestedWorkspaceId).toBe('');
    const setupResponse = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set(authHeader)
      .send({
        name: 'Journey workspace',
        kind: 'personal',
        defaultCurrency: 'VND',
        initialAccount: {
          name: 'Journey cash',
          iconKey: 'cash',
          kind: 'cash',
          currency: 'VND',
          openingBalanceMinorUnits: '0',
        },
      })
      .expect(201);
    const setup = setupResponse.body as {
      readonly workspace: { readonly id: string };
      readonly account: { readonly id: string };
    };
    const workspaceId = setup.workspace.id;

    const membersResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspaceId}/members`)
      .set(authHeader)
      .expect(200);
    const member = (
      membersResponse.body as readonly { readonly id: string }[]
    )[0];
    expect(member).toBeDefined();

    const account = setup.account;

    const secondAccountResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/accounts`)
      .set(authHeader)
      .send({ name: 'Journey bank', kind: 'bank' })
      .expect(201);
    const secondAccount = secondAccountResponse.body as { readonly id: string };

    await request(app.getHttpServer())
      .post(
        `/v1/workspaces/${workspaceId}/accounts/${account.id}/opening-balance`,
      )
      .set(authHeader)
      .set('Idempotency-Key', 'e2e-journey-opening')
      .send({
        amountMinorUnits: '100000',
        effectiveDate: '2026-09-01',
        description: 'Opening balance',
      })
      .expect(201);

    const incomePayload = {
      type: 'income',
      amountMinorUnits: '25000',
      accountId: account.id,
      effectiveDate: '2026-09-01',
      description: 'Salary',
    };
    const incomeResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/transactions`)
      .set(authHeader)
      .set('Idempotency-Key', 'e2e-journey-income')
      .send(incomePayload)
      .expect(201);
    const income = incomeResponse.body as { readonly id: string };
    const replayResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/transactions`)
      .set(authHeader)
      .set('Idempotency-Key', 'e2e-journey-income')
      .send(incomePayload)
      .expect(201);
    expect((replayResponse.body as { readonly id: string }).id).toBe(income.id);

    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/transactions`)
      .set(authHeader)
      .set('Idempotency-Key', 'e2e-journey-expense')
      .send({
        type: 'expense',
        amountMinorUnits: '5000',
        accountId: account.id,
        effectiveDate: '2026-09-01',
        description: 'Groceries',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/transactions`)
      .set(authHeader)
      .set('Idempotency-Key', 'e2e-journey-transfer')
      .send({
        type: 'transfer',
        amountMinorUnits: '10000',
        accountId: account.id,
        destinationAccountId: secondAccount.id,
        effectiveDate: '2026-09-01',
        description: 'Move to bank',
      })
      .expect(201);

    const budgetResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/budgets`)
      .set(authHeader)
      .send({ name: 'Journey food' })
      .expect(201);
    const budget = budgetResponse.body as { readonly id: string };
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/tags`)
      .set(authHeader)
      .send({ name: 'Journey tag' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/budget-periods`)
      .set(authHeader)
      .send({
        month: '2026-09',
        baseMinorUnits: '100000',
        constraints: [
          {
            budgetId: budget.id,
            mode: 'SHARED_POOL',
            fixedMinorUnits: '10000',
            percentageBasisPoints: 0,
            rolloverMode: 'NONE',
          },
        ],
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspaceId}/budget-periods/2026-09`)
      .set(authHeader)
      .expect(200);

    const collectionResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/group/collections`)
      .set(authHeader)
      .send({ name: 'Journey collection' })
      .expect(201);
    const collection = collectionResponse.body as { readonly id: string };
    const participantResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/group/participants`)
      .set(authHeader)
      .send({ memberId: member?.id, displayName: 'Journey owner' })
      .expect(201);
    const participant = participantResponse.body as { readonly id: string };
    await request(app.getHttpServer())
      .post(
        `/v1/workspaces/${workspaceId}/group/collections/${collection.id}/obligations`,
      )
      .set(authHeader)
      .send({ participantId: participant.id, amountMinorUnits: '3000' })
      .expect(201);
    const submissionResponse = await request(app.getHttpServer())
      .post(
        `/v1/workspaces/${workspaceId}/group/collections/${collection.id}/submissions`,
      )
      .set(authHeader)
      .send({
        participantId: participant.id,
        accountId: account.id,
        amountMinorUnits: '3000',
      })
      .expect(201);
    const submission = submissionResponse.body as { readonly id: string };
    await request(app.getHttpServer())
      .post(
        `/v1/workspaces/${workspaceId}/group/submissions/${submission.id}/verify`,
      )
      .set(authHeader)
      .send({ effectiveDate: '2026-09-01' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/group/expenses`)
      .set(authHeader)
      .set('Idempotency-Key', 'e2e-journey-group-expense')
      .send({
        accountId: account.id,
        amountMinorUnits: '7000',
        description: 'Journey treasury expense',
        effectiveDate: '2026-09-01',
      })
      .expect(201);

    const importResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/imports`)
      .set(authHeader)
      .send({
        accountId: account.id,
        fileName: 'journey.csv',
        csvContent:
          'date,amountMinorUnits,type,description,sourceKey\n2026-09-01,7000,expense,Imported expense,journey-row-1',
      })
      .expect(201);
    const importSession = importResponse.body as { readonly id: string };
    const recordsResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspaceId}/imports/${importSession.id}/records`)
      .set(authHeader)
      .expect(200);
    const record = (
      recordsResponse.body as readonly { readonly id: string }[]
    )[0];
    expect(record).toBeDefined();
    await request(app.getHttpServer())
      .post(
        `/v1/workspaces/${workspaceId}/imports/records/${record?.id}/confirm`,
      )
      .set(authHeader)
      .set('Idempotency-Key', 'e2e-journey-import-confirm')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspaceId}/reconciliations`)
      .set(authHeader)
      .send({
        accountId: account.id,
        statementDate: '2026-09-01',
        externalBalanceMinorUnits: '99000',
      })
      .expect(201);

    const overviewResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspaceId}/overview`)
      .set(authHeader)
      .expect(200);
    const overview = overviewResponse.body as {
      readonly accounts: readonly unknown[];
      readonly recentTransactions: readonly unknown[];
    };
    expect(overview.accounts).toHaveLength(2);
    expect(overview.recentTransactions.length).toBeGreaterThanOrEqual(6);
  });
});
