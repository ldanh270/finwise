import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  AuthenticatedActor,
  DEFAULT_PROVIDER_ISSUER,
  TokenVerifierPort,
} from '../shared/application/auth';
import { FinwiseError } from '../shared/errors/finwise-error';
import { JwtTokenService } from './jwt-token.service';

export interface AuthenticatedRequest extends Request {
  actor?: AuthenticatedActor;
  requestId?: string;
}

export const AUTH_GUARD = Symbol('AUTH_GUARD');

@Injectable()
export class FinwiseTokenVerifier implements TokenVerifierPort {
  constructor(private readonly jwtTokens = new JwtTokenService()) {}

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
    return this.jwtTokens.verifyAccessToken(token);
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
