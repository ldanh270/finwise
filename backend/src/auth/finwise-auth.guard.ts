import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import {
  AuthenticatedActor,
  DEFAULT_PROVIDER_ISSUER,
  TokenVerifierPort,
} from '../shared/application/auth';
import { FinwiseError } from '../shared/errors/finwise-error';

export interface AuthenticatedRequest extends Request {
  actor?: AuthenticatedActor;
  requestId?: string;
}

export const AUTH_GUARD = Symbol('AUTH_GUARD');

@Injectable()
export class FinwiseTokenVerifier implements TokenVerifierPort {
  verify(
    authorizationHeader: string | undefined,
    devUserId?: string,
  ): AuthenticatedActor {
    const allowDevTokens =
      process.env.FINWISE_DEV_AUTH !== 'false' &&
      process.env.NODE_ENV !== 'production';
    if (allowDevTokens && devUserId) {
      return {
        userId: devUserId,
        providerIssuer: DEFAULT_PROVIDER_ISSUER,
        providerSubject: devUserId,
      };
    }
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw FinwiseError.authRequired();
    }
    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (allowDevTokens && token.startsWith('dev:')) {
      const userId = token.slice('dev:'.length).trim();
      if (userId.length > 0 && userId.length <= 100) {
        return {
          userId,
          providerIssuer: DEFAULT_PROVIDER_ISSUER,
          providerSubject: userId,
        };
      }
    }
    return this.verifySupabaseHs256(token);
  }

  private verifySupabaseHs256(token: string): AuthenticatedActor {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      throw FinwiseError.authRequired();
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw FinwiseError.authRequired();
    }
    const [encodedHeader, encodedPayload, signature] = parts;
    let header: JwtHeader;
    let payload: JwtPayload;
    try {
      header = parseBase64Json<JwtHeader>(encodedHeader);
      payload = parseBase64Json<JwtPayload>(encodedPayload);
    } catch {
      throw FinwiseError.authRequired();
    }
    if (
      header.alg !== 'HS256' ||
      typeof payload.sub !== 'string' ||
      !payload.sub
    ) {
      throw FinwiseError.authRequired();
    }
    const expected = createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const provided = Buffer.from(signature, 'base64url');
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw FinwiseError.authRequired();
    }
    if (
      typeof payload.exp !== 'number' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw FinwiseError.sessionExpired();
    }
    const issuer =
      typeof payload.iss === 'string'
        ? payload.iss
        : process.env.SUPABASE_JWT_ISSUER;
    if (!issuer) {
      throw FinwiseError.authRequired();
    }
    const audienceValid =
      payload.aud === undefined ||
      payload.aud === 'authenticated' ||
      (Array.isArray(payload.aud) && payload.aud.includes('authenticated'));
    if (!audienceValid) {
      throw FinwiseError.authRequired();
    }
    return {
      userId: payload.sub,
      providerIssuer: issuer,
      providerSubject: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      displayName:
        typeof payload.user_metadata?.full_name === 'string'
          ? payload.user_metadata.full_name
          : undefined,
    };
  }
}

@Injectable()
export class FinwiseAuthGuard implements CanActivate {
  constructor(private readonly verifier: FinwiseTokenVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const devUserHeader = request.headers['x-finwise-user-id'];
    const devUserId =
      typeof devUserHeader === 'string' ? devUserHeader : undefined;
    request.actor = this.verifier.verify(
      request.headers.authorization,
      devUserId,
    );
    return true;
  }
}

export function actorFromRequest(
  request: AuthenticatedRequest,
): AuthenticatedActor {
  if (!request.actor) {
    throw FinwiseError.authRequired();
  }
  return request.actor;
}

interface JwtHeader {
  readonly alg?: unknown;
}

interface JwtPayload {
  readonly sub?: unknown;
  readonly iss?: unknown;
  readonly exp?: unknown;
  readonly aud?: unknown;
  readonly email?: unknown;
  readonly user_metadata?: Record<string, unknown>;
}

function parseBase64Json<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}
