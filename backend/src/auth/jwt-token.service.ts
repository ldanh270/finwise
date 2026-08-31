import { Injectable } from '@nestjs/common';
import {
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';
import {
  AuthenticatedActor,
  DEFAULT_PROVIDER_ISSUER,
} from '../shared/application/auth';
import { FinwiseError } from '../shared/errors/finwise-error';
import type { AccessTokenIssuerPort } from './application/auth.types';

const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;
const JWT_ALGORITHM = 'RS256';

interface AccessTokenClaims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
  readonly typ: 'access';
  readonly sid: string;
  readonly ver: number;
  readonly email?: string;
  readonly name?: string;
}

interface JwtHeader {
  readonly alg?: unknown;
  readonly typ?: unknown;
  readonly kid?: unknown;
}

interface JwtPayload {
  readonly iss?: unknown;
  readonly aud?: unknown;
  readonly sub?: unknown;
  readonly iat?: unknown;
  readonly exp?: unknown;
  readonly jti?: unknown;
  readonly typ?: unknown;
  readonly sid?: unknown;
  readonly ver?: unknown;
  readonly email?: unknown;
  readonly name?: unknown;
}

@Injectable()
export class JwtTokenService implements AccessTokenIssuerPort {
  private privateKey?: KeyObject;
  private publicKey?: KeyObject;

  issueAccessToken(
    actor: AuthenticatedActor,
    sessionId: string,
    tokenVersion = 1,
  ): { readonly accessToken: string; readonly expiresAt: Date } {
    const config = this.readConfig();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = issuedAt + config.accessTtlSeconds;
    const payload: AccessTokenClaims = {
      iss: config.issuer,
      aud: config.audience,
      sub: actor.userId,
      iat: issuedAt,
      exp: expiresAtSeconds,
      jti: randomUUID(),
      typ: 'access',
      sid: sessionId,
      ver: tokenVersion,
      ...(actor.email ? { email: actor.email } : {}),
      ...(actor.displayName ? { name: actor.displayName } : {}),
    };
    const encodedHeader = encodeJson({
      alg: JWT_ALGORITHM,
      typ: 'JWT',
      kid: config.keyId,
    });
    const encodedPayload = encodeJson(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = sign(
      'RSA-SHA256',
      Buffer.from(signingInput),
      this.getPrivateKey(),
    );
    return {
      accessToken: `${signingInput}.${signature.toString('base64url')}`,
      expiresAt: new Date(expiresAtSeconds * 1000),
    };
  }

  verifyAccessToken(token: string): AuthenticatedActor {
    const parts = token.split('.');
    if (parts.length !== 3) throw FinwiseError.authRequired();
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    let header: JwtHeader;
    let payload: JwtPayload;
    try {
      header = decodeJson<JwtHeader>(encodedHeader);
      payload = decodeJson<JwtPayload>(encodedPayload);
    } catch {
      throw FinwiseError.authRequired();
    }
    const config = this.readConfig();
    if (
      header.alg !== JWT_ALGORITHM ||
      header.typ !== 'JWT' ||
      header.kid !== config.keyId ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      payload.typ !== 'access' ||
      typeof payload.iss !== 'string' ||
      payload.iss !== config.issuer ||
      !audienceMatches(payload.aud, config.audience) ||
      !isNumericClaim(payload.exp) ||
      !isNumericClaim(payload.iat) ||
      !isNumericClaim(payload.ver) ||
      typeof payload.sid !== 'string' ||
      payload.sid.length === 0 ||
      typeof payload.jti !== 'string' ||
      payload.jti.length === 0
    ) {
      throw FinwiseError.authRequired();
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) throw FinwiseError.sessionExpired();
    if (payload.iat > now + 60) throw FinwiseError.authRequired();
    let valid = false;
    try {
      valid = verify(
        'RSA-SHA256',
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        this.getPublicKey(),
        Buffer.from(encodedSignature, 'base64url'),
      );
    } catch {
      valid = false;
    }
    if (!valid) throw FinwiseError.authRequired();
    return {
      userId: payload.sub,
      providerIssuer: payload.iss,
      providerSubject: payload.sub,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      ...(typeof payload.name === 'string'
        ? { displayName: payload.name }
        : {}),
    };
  }

  private getPrivateKey(): KeyObject {
    if (!this.privateKey) {
      const value = process.env.FINWISE_JWT_PRIVATE_KEY_BASE64?.trim();
      if (!value) throw FinwiseError.configuration();
      try {
        this.privateKey = createPrivateKey({
          key: Buffer.from(value, 'base64'),
          format: 'der',
          type: 'pkcs8',
        });
      } catch {
        throw FinwiseError.configuration();
      }
    }
    return this.privateKey;
  }

  private getPublicKey(): KeyObject {
    if (!this.publicKey) {
      const value = process.env.FINWISE_JWT_PUBLIC_KEY_BASE64?.trim();
      if (!value) throw FinwiseError.configuration();
      try {
        this.publicKey = createPublicKey({
          key: Buffer.from(value, 'base64'),
          format: 'der',
          type: 'spki',
        });
      } catch {
        throw FinwiseError.configuration();
      }
    }
    return this.publicKey;
  }

  private readConfig(): {
    readonly issuer: string;
    readonly audience: string;
    readonly keyId: string;
    readonly accessTtlSeconds: number;
  } {
    const issuer =
      process.env.FINWISE_JWT_ISSUER?.trim() || DEFAULT_PROVIDER_ISSUER;
    const audience = process.env.FINWISE_JWT_AUDIENCE?.trim() || 'finwise-api';
    const keyId = process.env.FINWISE_JWT_KEY_ID?.trim() || 'local';
    const parsedTtl = Number(process.env.FINWISE_ACCESS_TTL_SECONDS);
    const accessTtlSeconds =
      Number.isSafeInteger(parsedTtl) && parsedTtl >= 60 && parsedTtl <= 3600
        ? parsedTtl
        : DEFAULT_ACCESS_TTL_SECONDS;
    return { issuer, audience, keyId, accessTtlSeconds };
  }
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

function audienceMatches(value: unknown, expected: string): boolean {
  return (
    (typeof value === 'string' && value === expected) ||
    (Array.isArray(value) && value.includes(expected))
  );
}

function isNumericClaim(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}
