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

  it('bootstraps a dev identity and personal workspace', async () => {
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
    expect(body.workspaces).toHaveLength(1);
    expect(body.suggestedWorkspaceId).toBe(body.workspaces[0]?.id);

    await request(app.getHttpServer())
      .get(`/v1/workspaces/${body.suggestedWorkspaceId}/overview`)
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200)
      .expect((overviewResponse) => {
        const overview = overviewResponse.body as {
          readonly workspaceId: string;
          readonly accounts: readonly unknown[];
          readonly recentTransactions: readonly unknown[];
        };
        expect(overview.workspaceId).toBe(body.suggestedWorkspaceId);
        expect(overview.accounts).toHaveLength(0);
        expect(overview.recentTransactions).toHaveLength(0);
      });

    const roleResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${body.suggestedWorkspaceId}/roles`)
      .set('x-finwise-user-id', 'e2e-user')
      .send({ name: 'Reviewer', permissions: ['workspace.read'] })
      .expect(201);
    expect((roleResponse.body as { readonly name: string }).name).toBe(
      'Reviewer',
    );

    const rolesResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${body.suggestedWorkspaceId}/roles`)
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200);
    expect(rolesResponse.body as readonly unknown[]).toHaveLength(2);

    const membersResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${body.suggestedWorkspaceId}/members`)
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200);
    const members = membersResponse.body as readonly {
      readonly id: string;
      readonly isOwner: boolean;
    }[];
    expect(members).toHaveLength(1);
    expect(members[0]?.isOwner).toBe(true);

    const accountResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${body.suggestedWorkspaceId}/accounts`)
      .set('x-finwise-user-id', 'e2e-user')
      .send({ name: 'Cash', kind: 'cash' })
      .expect(201);
    const account = accountResponse.body as { readonly id: string };
    await request(app.getHttpServer())
      .post(
        `/v1/workspaces/${body.suggestedWorkspaceId}/accounts/${account.id}/access`,
      )
      .set('x-finwise-user-id', 'e2e-user')
      .send({ visibilityMode: 'owner_only' })
      .expect(201);

    await request(app.getHttpServer())
      .get(
        `/v1/workspaces/${body.suggestedWorkspaceId}/members/${members[0]?.id}/access-preview`,
      )
      .set('x-finwise-user-id', 'e2e-user')
      .expect(200)
      .expect((previewResponse) => {
        const preview = previewResponse.body as {
          readonly accounts: readonly unknown[];
        };
        expect(preview.accounts).toHaveLength(1);
      });
  });
});
