import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  CategoryType,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from '../generated/prisma/enums';

dotenv.config({ quiet: true });

const FINWISE_SCHEMA = 'finwise';
const SEED_DATE = new Date('2026-01-01T00:00:00.000Z');

const SEED_IDS = {
  user: '00000000-0000-4000-8000-000000000001',
  workspace: '00000000-0000-4000-8000-000000000101',
  workspaceMember: '00000000-0000-4000-8000-000000000102',
  cashFund: '00000000-0000-4000-8000-000000000201',
  bankFund: '00000000-0000-4000-8000-000000000202',
  incomeCategory: '00000000-0000-4000-8000-000000000301',
  expenseCategory: '00000000-0000-4000-8000-000000000302',
} as const;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the database seed.');
  }
  return databaseUrl;
}

function assertSeedingIsAllowed(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEMO_SEED !== 'true'
  ) {
    throw new Error(
      'Refusing to seed production. Set ALLOW_DEMO_SEED=true only for an intentional demo seed.',
    );
  }
}

async function main(): Promise<void> {
  assertSeedingIsAllowed();

  const adapter = new PrismaPg(
    { connectionString: getDatabaseUrl() },
    { schema: FINWISE_SCHEMA },
  );
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: SEED_IDS.user },
        update: {
          email: 'demo@finwise.local',
          displayName: 'Finwise Demo User',
        },
        create: {
          id: SEED_IDS.user,
          externalAuthUserId: 'finwise-demo-user',
          email: 'demo@finwise.local',
          displayName: 'Finwise Demo User',
        },
      });

      await transaction.workspace.upsert({
        where: { id: SEED_IDS.workspace },
        update: { name: 'Finwise Demo Workspace' },
        create: {
          id: SEED_IDS.workspace,
          name: 'Finwise Demo Workspace',
        },
      });

      await transaction.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: SEED_IDS.workspace,
            userId: SEED_IDS.user,
          },
        },
        update: {
          role: WorkspaceMemberRole.owner,
          status: WorkspaceMemberStatus.active,
          joinedAt: SEED_DATE,
        },
        create: {
          id: SEED_IDS.workspaceMember,
          workspaceId: SEED_IDS.workspace,
          userId: SEED_IDS.user,
          role: WorkspaceMemberRole.owner,
          status: WorkspaceMemberStatus.active,
          joinedAt: SEED_DATE,
        },
      });

      await transaction.fund.upsert({
        where: {
          workspaceId_id: {
            workspaceId: SEED_IDS.workspace,
            id: SEED_IDS.cashFund,
          },
        },
        update: { name: 'Cash', currencyCode: 'VND' },
        create: {
          id: SEED_IDS.cashFund,
          workspaceId: SEED_IDS.workspace,
          name: 'Cash',
          currencyCode: 'VND',
          createdByUserId: SEED_IDS.user,
        },
      });

      await transaction.fund.upsert({
        where: {
          workspaceId_id: {
            workspaceId: SEED_IDS.workspace,
            id: SEED_IDS.bankFund,
          },
        },
        update: { name: 'Bank account', currencyCode: 'VND' },
        create: {
          id: SEED_IDS.bankFund,
          workspaceId: SEED_IDS.workspace,
          name: 'Bank account',
          currencyCode: 'VND',
          createdByUserId: SEED_IDS.user,
        },
      });

      await transaction.category.upsert({
        where: {
          workspaceId_id: {
            workspaceId: SEED_IDS.workspace,
            id: SEED_IDS.incomeCategory,
          },
        },
        update: { name: 'Salary', type: CategoryType.income },
        create: {
          id: SEED_IDS.incomeCategory,
          workspaceId: SEED_IDS.workspace,
          name: 'Salary',
          type: CategoryType.income,
          createdByUserId: SEED_IDS.user,
        },
      });

      await transaction.category.upsert({
        where: {
          workspaceId_id: {
            workspaceId: SEED_IDS.workspace,
            id: SEED_IDS.expenseCategory,
          },
        },
        update: { name: 'Food', type: CategoryType.expense },
        create: {
          id: SEED_IDS.expenseCategory,
          workspaceId: SEED_IDS.workspace,
          name: 'Food',
          type: CategoryType.expense,
          createdByUserId: SEED_IDS.user,
        },
      });
    });

    console.log('Finwise demo seed completed.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown seed error';
  console.error(`Finwise demo seed failed: ${message}`);
  process.exitCode = 1;
});
