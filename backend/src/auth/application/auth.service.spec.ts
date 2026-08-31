import { generateKeyPairSync } from 'node:crypto';
import { JwtTokenService } from '../jwt-token.service';
import {
  AuthRepositoryPort,
  AuthRefreshSessionRecord,
  AuthUserRecord,
  CreateAuthUserInput,
  CreateRefreshSessionInput,
  RotateRefreshSessionInput,
} from './auth.types';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });
  const original = {
    privateKey: process.env.FINWISE_JWT_PRIVATE_KEY_BASE64,
    publicKey: process.env.FINWISE_JWT_PUBLIC_KEY_BASE64,
    issuer: process.env.FINWISE_JWT_ISSUER,
    audience: process.env.FINWISE_JWT_AUDIENCE,
    keyId: process.env.FINWISE_JWT_KEY_ID,
  };

  beforeAll(() => {
    process.env.FINWISE_JWT_PRIVATE_KEY_BASE64 =
      keys.privateKey.toString('base64');
    process.env.FINWISE_JWT_PUBLIC_KEY_BASE64 =
      keys.publicKey.toString('base64');
    process.env.FINWISE_JWT_ISSUER = 'https://auth.test';
    process.env.FINWISE_JWT_AUDIENCE = 'finwise-api';
    process.env.FINWISE_JWT_KEY_ID = 'test';
  });

  afterAll(() => {
    restore('FINWISE_JWT_PRIVATE_KEY_BASE64', original.privateKey);
    restore('FINWISE_JWT_PUBLIC_KEY_BASE64', original.publicKey);
    restore('FINWISE_JWT_ISSUER', original.issuer);
    restore('FINWISE_JWT_AUDIENCE', original.audience);
    restore('FINWISE_JWT_KEY_ID', original.keyId);
  });

  it('registers, signs an access token, and rotates refresh tokens', async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService(repository, new JwtTokenService());
    const first = await service.register(
      { email: ' User@Example.com ', password: 'correct horse battery staple' },
      {},
    );
    expect(first.user.email).toBe('user@example.com');
    expect(first.refreshToken).toBeTruthy();
    expect(
      new JwtTokenService().verifyAccessToken(first.accessToken).userId,
    ).toBe(first.user.id);

    const second = await service.refresh(first.refreshToken, {});
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(first.refreshToken, {})).rejects.toThrow(
      'Session has expired',
    );
    expect(
      repository.sessions.every((session) => session.status === 'revoked'),
    ).toBe(true);
  });

  it('locks an account after five failed passwords', async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService(repository, new JwtTokenService());
    await service.register(
      { email: 'user@example.com', password: 'correct horse battery staple' },
      {},
    );
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(
        service.login(
          { email: 'user@example.com', password: 'wrong password' },
          {},
        ),
      ).rejects.toThrow('Email or password is incorrect');
    }
    await expect(
      service.login(
        { email: 'user@example.com', password: 'wrong password' },
        {},
      ),
    ).rejects.toThrow('Too many failed attempts');
  });
});

class InMemoryAuthRepository implements AuthRepositoryPort {
  users: AuthUserRecord[] = [];
  sessions: AuthRefreshSessionRecord[] = [];
  private nextId = 1;

  findUserByEmail(email: string): Promise<AuthUserRecord | undefined> {
    return Promise.resolve(this.users.find((user) => user.email === email));
  }

  findUserById(id: string): Promise<AuthUserRecord | undefined> {
    return Promise.resolve(this.users.find((user) => user.id === id));
  }

  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const user: AuthUserRecord = {
      id: `user-${this.nextId++}`,
      email: input.email,
      passwordHash: input.passwordHash,
      status: 'active',
      failedLoginCount: 0,
    };
    this.users.push(user);
    return Promise.resolve(user);
  }

  async recordFailedLogin(
    id: string,
    count: number,
    lockedUntil?: Date,
  ): Promise<void> {
    const user = await this.findUserById(id);
    if (user) {
      this.users = this.users.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              failedLoginCount: count,
              ...(lockedUntil ? { lockedUntil } : {}),
            }
          : candidate,
      );
    }
  }

  recordSuccessfulLogin(id: string): Promise<void> {
    this.users = this.users.map((user) =>
      user.id === id
        ? { ...user, failedLoginCount: 0, lockedUntil: undefined }
        : user,
    );
    return Promise.resolve();
  }

  createRefreshSession(
    input: CreateRefreshSessionInput,
  ): Promise<AuthRefreshSessionRecord> {
    const session: AuthRefreshSessionRecord = {
      id: `session-${this.nextId++}`,
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.tokenHash,
      status: 'active',
      expiresAt: input.expiresAt,
    };
    this.sessions.push(session);
    return Promise.resolve(session);
  }

  findRefreshSessionByHash(
    hash: string,
  ): Promise<AuthRefreshSessionRecord | undefined> {
    return Promise.resolve(
      this.sessions.find((session) => session.tokenHash === hash),
    );
  }

  async rotateRefreshSession(
    input: RotateRefreshSessionInput,
  ): Promise<AuthRefreshSessionRecord | undefined> {
    const current = this.sessions.find(
      (session) =>
        session.id === input.currentSessionId &&
        session.status === 'active' &&
        session.expiresAt > input.now,
    );
    if (!current) return undefined;
    this.sessions = this.sessions.map((session) =>
      session.id === current.id ? { ...session, status: 'rotated' } : session,
    );
    return this.createRefreshSession(input.next);
  }

  revokeSession(id: string): Promise<void> {
    this.sessions = this.sessions.map((session) =>
      session.id === id ? { ...session, status: 'revoked' } : session,
    );
    return Promise.resolve();
  }

  revokeFamily(familyId: string): Promise<void> {
    this.sessions = this.sessions.map((session) =>
      session.familyId === familyId
        ? { ...session, status: 'revoked' }
        : session,
    );
    return Promise.resolve();
  }
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
