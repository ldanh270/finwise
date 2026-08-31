import { Injectable } from '@nestjs/common';
import {
  AuthRefreshSessionStatus as PrismaAuthRefreshSessionStatus,
  UserStatus as PrismaUserStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  AuthRefreshSessionRecord,
  AuthRepositoryPort,
  AuthUserRecord,
  CreateAuthUserInput,
  CreateRefreshSessionInput,
  RotateRefreshSessionInput,
} from '../application/auth.types';

@Injectable()
export class PrismaAuthRepository implements AuthRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(
    normalizedEmail: string,
  ): Promise<AuthUserRecord | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    return user ? mapUser(user) : undefined;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? mapUser(user) : undefined;
  }

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const user = await this.prisma.user.create({
      data: {
        normalizedEmail: input.email,
        emailSnapshot: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        status: PrismaUserStatus.active,
      },
    });
    return mapUser(user);
  }

  async recordFailedLogin(
    userId: string,
    failedLoginCount: number,
    lockedUntil?: Date,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount, lockedUntil: lockedUntil ?? null },
    });
  }

  async recordSuccessfulLogin(userId: string, at: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: at },
    });
  }

  async createRefreshSession(
    input: CreateRefreshSessionInput,
  ): Promise<AuthRefreshSessionRecord> {
    const session = await this.prisma.authRefreshSession.create({
      data: {
        userId: input.userId,
        familyId: input.familyId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        parentId: input.parentId,
        userAgent: input.userAgent,
        ipHash: input.ipHash,
        status: PrismaAuthRefreshSessionStatus.active,
      },
    });
    return mapRefreshSession(session);
  }

  async findRefreshSessionByHash(
    tokenHash: string,
  ): Promise<AuthRefreshSessionRecord | undefined> {
    const session = await this.prisma.authRefreshSession.findUnique({
      where: { tokenHash },
    });
    return session ? mapRefreshSession(session) : undefined;
  }

  async rotateRefreshSession(
    input: RotateRefreshSessionInput,
  ): Promise<AuthRefreshSessionRecord | undefined> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.authRefreshSession.updateMany({
        where: {
          id: input.currentSessionId,
          status: PrismaAuthRefreshSessionStatus.active,
          expiresAt: { gt: input.now },
        },
        data: {
          status: PrismaAuthRefreshSessionStatus.rotated,
          lastUsedAt: input.now,
        },
      });
      if (updated.count !== 1) return undefined;
      const next = await transaction.authRefreshSession.create({
        data: {
          userId: input.next.userId,
          familyId: input.next.familyId,
          tokenHash: input.next.tokenHash,
          expiresAt: input.next.expiresAt,
          parentId: input.currentSessionId,
          userAgent: input.next.userAgent,
          ipHash: input.next.ipHash,
          status: PrismaAuthRefreshSessionStatus.active,
        },
      });
      await transaction.authRefreshSession.update({
        where: { id: input.currentSessionId },
        data: { replacedById: next.id },
      });
      return mapRefreshSession(next);
    });
  }

  async revokeSession(sessionId: string, at: Date): Promise<void> {
    await this.prisma.authRefreshSession.updateMany({
      where: { id: sessionId, status: PrismaAuthRefreshSessionStatus.active },
      data: { status: PrismaAuthRefreshSessionStatus.revoked, revokedAt: at },
    });
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.prisma.authRefreshSession.updateMany({
      where: {
        familyId,
        status: {
          in: [
            PrismaAuthRefreshSessionStatus.active,
            PrismaAuthRefreshSessionStatus.rotated,
          ],
        },
      },
      data: { status: PrismaAuthRefreshSessionStatus.revoked, revokedAt: at },
    });
  }
}

function mapUser(user: {
  id: string;
  normalizedEmail: string | null;
  emailSnapshot: string | null;
  displayName: string | null;
  passwordHash: string | null;
  status: PrismaUserStatus;
  failedLoginCount: number;
  lockedUntil: Date | null;
}): AuthUserRecord {
  return {
    id: user.id,
    email: user.normalizedEmail ?? user.emailSnapshot ?? '',
    ...(user.displayName ? { displayName: user.displayName } : {}),
    passwordHash: user.passwordHash ?? '',
    status: user.status,
    failedLoginCount: user.failedLoginCount,
    ...(user.lockedUntil ? { lockedUntil: user.lockedUntil } : {}),
  };
}

function mapRefreshSession(session: {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  status: PrismaAuthRefreshSessionStatus;
  expiresAt: Date;
}): AuthRefreshSessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    familyId: session.familyId,
    tokenHash: session.tokenHash,
    status: session.status,
    expiresAt: session.expiresAt,
  };
}
