export type AuthUserStatus = 'active' | 'suspended' | 'deleted';
export type AuthRefreshSessionStatus = 'active' | 'rotated' | 'revoked';

export interface AuthUserRecord {
  readonly id: string;
  readonly email: string;
  readonly displayName?: string;
  readonly passwordHash: string;
  readonly status: AuthUserStatus;
  readonly failedLoginCount: number;
  readonly lockedUntil?: Date;
}

export interface AuthRefreshSessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly status: AuthRefreshSessionStatus;
  readonly expiresAt: Date;
}

export interface CreateAuthUserInput {
  readonly email: string;
  readonly displayName?: string;
  readonly passwordHash: string;
}

export interface CreateRefreshSessionInput {
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly parentId?: string;
  readonly userAgent?: string;
  readonly ipHash?: string;
}

export interface RotateRefreshSessionInput {
  readonly currentSessionId: string;
  readonly next: CreateRefreshSessionInput;
  readonly now: Date;
}

export interface AuthRepositoryPort {
  findUserByEmail(normalizedEmail: string): Promise<AuthUserRecord | undefined>;
  findUserById(userId: string): Promise<AuthUserRecord | undefined>;
  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord>;
  recordFailedLogin(
    userId: string,
    failedLoginCount: number,
    lockedUntil?: Date,
  ): Promise<void>;
  recordSuccessfulLogin(userId: string, at: Date): Promise<void>;
  createRefreshSession(
    input: CreateRefreshSessionInput,
  ): Promise<AuthRefreshSessionRecord>;
  findRefreshSessionByHash(
    tokenHash: string,
  ): Promise<AuthRefreshSessionRecord | undefined>;
  rotateRefreshSession(
    input: RotateRefreshSessionInput,
  ): Promise<AuthRefreshSessionRecord | undefined>;
  revokeSession(sessionId: string, at: Date): Promise<void>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
}

export interface AccessTokenIssuerPort {
  issueAccessToken(
    actor: {
      readonly userId: string;
      readonly providerIssuer: string;
      readonly providerSubject: string;
      readonly email?: string;
      readonly displayName?: string;
    },
    sessionId: string,
  ): { readonly accessToken: string; readonly expiresAt: Date };
}
