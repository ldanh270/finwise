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
  });
});
