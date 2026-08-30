export const AUTHENTICATED_ACTOR = Symbol('AUTHENTICATED_ACTOR');

export interface AuthenticatedActor {
  readonly userId: string;
  readonly providerIssuer: string;
  readonly providerSubject: string;
  readonly email?: string;
  readonly displayName?: string;
}

export interface TokenVerifierPort {
  verify(
    authorizationHeader: string | undefined,
    devUserId?: string,
  ): AuthenticatedActor;
}

export const DEFAULT_PROVIDER_ISSUER = 'https://local.finwise.dev';
