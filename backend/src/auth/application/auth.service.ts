import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuthenticatedActor } from '../../shared/application/auth';
import { FinwiseError } from '../../shared/errors/finwise-error';
import { hashPassword, verifyPassword } from '../password-hasher';
import type {
  AccessTokenIssuerPort,
  AuthRepositoryPort,
  AuthUserRecord,
  CreateRefreshSessionInput,
} from './auth.types';

const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const DEFAULT_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthRequestContext {
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface AuthUserView {
  readonly id: string;
  readonly email: string;
  readonly displayName?: string;
}

export interface AuthSessionView {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly user: AuthUserView;
}

export interface AuthSessionResult extends AuthSessionView {
  readonly refreshToken: string;
}

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export class AuthService {
  constructor(
    private readonly repository: AuthRepositoryPort,
    private readonly jwtTokens: AccessTokenIssuerPort,
  ) {}

  async register(
    input: RegisterInput,
    context: AuthRequestContext,
  ): Promise<AuthSessionResult> {
    const email = normalizeEmail(input.email);
    validateCredentials(email, input.password);
    const displayName = normalizeDisplayName(input.displayName);
    const existing = await this.repository.findUserByEmail(email);
    if (existing)
      throw FinwiseError.conflict('An account with this email already exists.');
    let user: AuthUserRecord;
    try {
      user = await this.repository.createUser({
        email,
        displayName,
        passwordHash: hashPassword(input.password),
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw FinwiseError.conflict(
          'An account with this email already exists.',
        );
      }
      throw error;
    }
    return this.startSession(user, context);
  }

  async login(
    input: LoginInput,
    context: AuthRequestContext,
  ): Promise<AuthSessionResult> {
    const email = normalizeEmail(input.email);
    validateCredentials(email, input.password, false);
    const user = await this.repository.findUserByEmail(email);
    if (!user || user.status !== 'active' || !user.passwordHash) {
      throw FinwiseError.invalidCredentials();
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw FinwiseError.accountLocked();
    }
    if (!verifyPassword(input.password, user.passwordHash)) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockedUntil =
        failedLoginCount >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : undefined;
      await this.repository.recordFailedLogin(
        user.id,
        failedLoginCount,
        lockedUntil,
      );
      if (lockedUntil) throw FinwiseError.accountLocked();
      throw FinwiseError.invalidCredentials();
    }
    await this.repository.recordSuccessfulLogin(user.id, new Date());
    return this.startSession(user, context);
  }

  async refresh(
    refreshToken: string | undefined,
    context: AuthRequestContext,
  ): Promise<AuthSessionResult> {
    if (!refreshToken) throw FinwiseError.sessionExpired();
    const tokenHash = hashRefreshToken(refreshToken);
    const current = await this.repository.findRefreshSessionByHash(tokenHash);
    if (!current) throw FinwiseError.sessionExpired();
    const now = new Date();
    if (current.status !== 'active' || current.expiresAt <= now) {
      await this.repository.revokeFamily(current.familyId, now);
      throw FinwiseError.sessionExpired();
    }
    const user = await this.repository.findUserById(current.userId);
    if (!user || user.status !== 'active' || !user.passwordHash) {
      await this.repository.revokeFamily(current.familyId, now);
      throw FinwiseError.sessionExpired();
    }
    const nextToken = generateRefreshToken();
    const nextInput = this.buildRefreshSessionInput(
      user.id,
      current.familyId,
      nextToken,
      context,
      current.id,
    );
    const next = await this.repository.rotateRefreshSession({
      currentSessionId: current.id,
      next: nextInput,
      now,
    });
    if (!next) {
      await this.repository.revokeFamily(current.familyId, now);
      throw FinwiseError.sessionExpired();
    }
    return this.toSessionView(user, next.id, nextToken);
  }

  async session(
    refreshToken: string | undefined,
  ): Promise<AuthUserView | undefined> {
    if (!refreshToken) return undefined;
    const current = await this.repository.findRefreshSessionByHash(
      hashRefreshToken(refreshToken),
    );
    if (
      !current ||
      current.status !== 'active' ||
      current.expiresAt <= new Date()
    ) {
      return undefined;
    }
    const user = await this.repository.findUserById(current.userId);
    if (!user || user.status !== 'active' || !user.passwordHash)
      return undefined;
    return toUserView(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const session = await this.repository.findRefreshSessionByHash(
      hashRefreshToken(refreshToken),
    );
    if (session) await this.repository.revokeSession(session.id, new Date());
  }

  private async startSession(
    user: AuthUserRecord,
    context: AuthRequestContext,
  ): Promise<AuthSessionResult> {
    const token = generateRefreshToken();
    const session = await this.repository.createRefreshSession(
      this.buildRefreshSessionInput(user.id, randomUUID(), token, context),
    );
    return this.toSessionView(user, session.id, token);
  }

  private buildRefreshSessionInput(
    userId: string,
    familyId: string,
    refreshToken: string,
    context: AuthRequestContext,
    parentId?: string,
  ): CreateRefreshSessionInput {
    const refreshTtl = parseRefreshTtl();
    return {
      userId,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtl * 1000),
      ...(parentId ? { parentId } : {}),
      ...(context.userAgent
        ? { userAgent: context.userAgent.slice(0, 512) }
        : {}),
      ...(context.ipAddress
        ? { ipHash: hashRefreshToken(context.ipAddress) }
        : {}),
    };
  }

  private toSessionView(
    user: AuthUserRecord,
    sessionId: string,
    refreshToken: string,
  ): AuthSessionResult {
    const actor: AuthenticatedActor = {
      userId: user.id,
      providerIssuer:
        process.env.FINWISE_JWT_ISSUER?.trim() || 'https://local.finwise.dev',
      providerSubject: user.id,
      email: user.email,
      ...(user.displayName ? { displayName: user.displayName } : {}),
    };
    const issued = this.jwtTokens.issueAccessToken(actor, sessionId);
    return {
      accessToken: issued.accessToken,
      accessTokenExpiresAt: issued.expiresAt.toISOString(),
      user: toUserView(user),
      refreshToken,
    };
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateCredentials(
  email: string,
  password: string,
  requireStrongPassword = true,
): void {
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw FinwiseError.validation('Enter a valid email address.');
  }
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    throw FinwiseError.validation('Password is too long.');
  }
  if (requireStrongPassword && password.length < MIN_PASSWORD_LENGTH) {
    throw FinwiseError.validation(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
}

function normalizeDisplayName(value: string | undefined): string | undefined {
  const displayName = value?.trim();
  if (!displayName) return undefined;
  if (displayName.length > 120) {
    throw FinwiseError.validation('Display name is too long.');
  }
  return displayName;
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseRefreshTtl(): number {
  const value = Number(process.env.FINWISE_REFRESH_TTL_SECONDS);
  return Number.isSafeInteger(value) &&
    value >= 300 &&
    value <= 90 * 24 * 60 * 60
    ? value
    : DEFAULT_REFRESH_TTL_SECONDS;
}

function toUserView(user: AuthUserRecord): AuthUserView {
  return {
    id: user.id,
    email: user.email,
    ...(user.displayName ? { displayName: user.displayName } : {}),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'P2002'
  );
}
