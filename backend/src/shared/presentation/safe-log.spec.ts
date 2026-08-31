import { redactSensitive, safeErrorMessage } from './safe-log';

describe('safe log redaction', () => {
  it('redacts sensitive keys recursively while preserving operational context', () => {
    expect(
      redactSensitive({
        requestId: 'req-1',
        authorization: 'Bearer secret-token',
        nested: { otp: '123456', accountId: 'account-1' },
        values: ['safe', { password: 'hidden' }],
      }),
    ).toEqual({
      requestId: 'req-1',
      authorization: '[REDACTED]',
      nested: { otp: '[REDACTED]', accountId: 'account-1' },
      values: ['safe', { password: '[REDACTED]' }],
    });
  });

  it('redacts credential-like values embedded in error text', () => {
    expect(
      safeErrorMessage(
        new Error('request failed authorization=abc123 password: hunter2'),
      ),
    ).toBe('request failed authorization=[REDACTED] password=[REDACTED]');
  });
});
