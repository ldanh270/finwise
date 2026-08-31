import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  MembershipStatus,
  PrismaClient,
  UserStatus,
  WorkspaceKind,
} from '../generated/prisma/client';
import { hashPassword } from '../src/auth/password-hasher';

dotenv.config({ quiet: true });

const FINWISE_SCHEMA = 'finwise';
const SEED_DATE = new Date('2026-01-01T00:00:00.000Z');
const IDS = {
  user: '00000000-0000-4000-8000-000000000001',
  workspace: '00000000-0000-4000-8000-000000000101',
  member: '00000000-0000-4000-8000-000000000102',
  role: '00000000-0000-4000-8000-000000000103',
} as const;

function getDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the database seed.');
  }
  return process.env.DATABASE_URL;
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
        where: { id: IDS.user },
        update: {
          normalizedEmail: 'demo@finwise.local',
          emailSnapshot: 'demo@finwise.local',
          displayName: 'Finwise Demo User',
          status: UserStatus.active,
        },
        create: {
          id: IDS.user,
          normalizedEmail: 'demo@finwise.local',
          emailSnapshot: 'demo@finwise.local',
          displayName: 'Finwise Demo User',
          passwordHash: hashPassword('finwise-demo-password'),
          status: UserStatus.active,
        },
      });
      await transaction.workspace.upsert({
        where: { id: IDS.workspace },
        update: { name: 'Finwise Demo Workspace' },
        create: {
          id: IDS.workspace,
          name: 'Finwise Demo Workspace',
          kind: WorkspaceKind.personal,
        },
      });
      await transaction.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: IDS.workspace, userId: IDS.user },
        },
        update: {
          isOwner: true,
          status: MembershipStatus.active,
          joinedAt: SEED_DATE,
        },
        create: {
          id: IDS.member,
          workspaceId: IDS.workspace,
          userId: IDS.user,
          isOwner: true,
          status: MembershipStatus.active,
          joinedAt: SEED_DATE,
        },
      });
      await transaction.workspace.update({
        where: { id: IDS.workspace },
        data: { ownerMembershipId: IDS.member },
      });
      await transaction.role.upsert({
        where: { id: IDS.role },
        update: { name: 'Owner', protected: true },
        create: {
          id: IDS.role,
          workspaceId: IDS.workspace,
          name: 'Owner',
          protected: true,
        },
      });
      await transaction.roleAssignment.upsert({
        where: { memberId_roleId: { memberId: IDS.member, roleId: IDS.role } },
        update: {},
        create: { memberId: IDS.member, roleId: IDS.role },
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
