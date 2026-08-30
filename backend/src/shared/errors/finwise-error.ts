export type FinwiseErrorCode =
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'IDENTITY_PROVISIONING_FAILED'
  | 'MEMBERSHIP_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'BUSINESS_STATE_INVALID';

export class FinwiseError extends Error {
  private constructor(
    readonly code: FinwiseErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = 'FinwiseError';
  }

  static authRequired(message = 'Authentication is required.'): FinwiseError {
    return new FinwiseError('AUTH_REQUIRED', message, 401);
  }

  static sessionExpired(): FinwiseError {
    return new FinwiseError('SESSION_EXPIRED', 'Session has expired.', 401);
  }

  static provisioning(message: string): FinwiseError {
    return new FinwiseError('IDENTITY_PROVISIONING_FAILED', message, 500);
  }

  static membership(): FinwiseError {
    return new FinwiseError(
      'MEMBERSHIP_REQUIRED',
      'You are not an active member of this workspace.',
      403,
    );
  }

  static permission(
    message = 'You do not have permission for this action.',
  ): FinwiseError {
    return new FinwiseError('PERMISSION_DENIED', message, 403);
  }

  static validation(
    message: string,
    details?: Readonly<Record<string, string>>,
  ): FinwiseError {
    return new FinwiseError('VALIDATION_ERROR', message, 400, details);
  }

  static notFound(resource: string): FinwiseError {
    return new FinwiseError(
      'RESOURCE_NOT_FOUND',
      `${resource} was not found.`,
      404,
    );
  }

  static conflict(message: string): FinwiseError {
    return new FinwiseError('CONFLICT', message, 409);
  }

  static idempotencyRequired(): FinwiseError {
    return new FinwiseError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key is required for financial commands.',
      400,
    );
  }

  static idempotencyReused(): FinwiseError {
    return new FinwiseError(
      'IDEMPOTENCY_KEY_REUSED',
      'Idempotency-Key was already used with a different request.',
      409,
    );
  }

  static businessState(message: string): FinwiseError {
    return new FinwiseError('BUSINESS_STATE_INVALID', message, 409);
  }
}
