import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';

describe('AuthController mobile session transport', () => {
  it('returns a refresh token only for mobile register/login responses', async () => {
    const authService = {
      register: jest.fn().mockResolvedValue(sessionResult()),
      login: jest.fn().mockResolvedValue(sessionResult()),
    };
    const controller = new AuthController(authService as never);
    const responseFixture = fakeResponse();
    const request = fakeRequest();

    const mobile = await controller.login(
      { email: 'member@example.com', password: 'password-password' },
      request,
      'mobile',
      responseFixture.response,
    );
    const web = await controller.login(
      { email: 'member@example.com', password: 'password-password' },
      request,
      'web',
      responseFixture.response,
    );

    expect(mobile).toHaveProperty('refreshToken', 'refresh-token');
    expect(web).not.toHaveProperty('refreshToken');
    expect(responseFixture.cookie).toHaveBeenCalledTimes(2);
  });

  it('accepts a mobile refresh token and rotates it without requiring a cookie', async () => {
    const authService = {
      refresh: jest.fn().mockResolvedValue(sessionResult('next-refresh-token')),
    };
    const controller = new AuthController(authService as never);
    const responseFixture = fakeResponse();

    const result = await controller.refresh(
      fakeRequest(),
      'mobile',
      'refresh-token',
      responseFixture.response,
    );

    const refresh = authService.refresh;
    expect(refresh).toHaveBeenCalledWith(
      'refresh-token',
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
    expect(result).toHaveProperty('refreshToken', 'next-refresh-token');
  });
});

function sessionResult(refreshToken = 'refresh-token') {
  return {
    accessToken: 'access-token',
    accessTokenExpiresAt: '2026-09-01T00:00:00.000Z',
    refreshToken,
    user: { id: 'user-1', email: 'member@example.com', displayName: 'Member' },
  };
}

function fakeRequest(): Request {
  return {
    ip: '127.0.0.1',
    headers: {},
    get: () => undefined,
  } as unknown as Request;
}

function fakeResponse(): {
  response: Response;
  cookie: jest.Mock;
} {
  const cookie = jest.fn();
  return {
    response: { cookie, clearCookie: jest.fn() } as unknown as Response,
    cookie,
  };
}
