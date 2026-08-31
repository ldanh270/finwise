import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService, AuthRequestContext } from './application/auth.service';
import { FinwiseError } from '../shared/errors/finwise-error';

const REFRESH_COOKIE = 'finwise_refresh';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  async register(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const displayName = readField(body, 'displayName');
    const result = await this.authService.register(
      {
        email: requireString(readField(body, 'email')),
        password: requireString(readField(body, 'password')),
        ...(typeof displayName === 'string' ? { displayName } : {}),
      },
      requestContext(request),
    );
    const { refreshToken, ...publicSession } = result;
    setRefreshCookie(response, refreshToken);
    return publicSession;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      {
        email: requireString(readField(body, 'email')),
        password: requireString(readField(body, 'password')),
      },
      requestContext(request),
    );
    const { refreshToken, ...publicSession } = result;
    setRefreshCookie(response, refreshToken);
    return publicSession;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = readCookie(request, REFRESH_COOKIE);
    try {
      const result = await this.authService.refresh(
        refreshToken,
        requestContext(request),
      );
      const { refreshToken: nextRefreshToken, ...publicSession } = result;
      setRefreshCookie(response, nextRefreshToken);
      return publicSession;
    } catch (error: unknown) {
      clearRefreshCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(readCookie(request, REFRESH_COOKIE));
    clearRefreshCookie(response);
  }

  @Get('session')
  @HttpCode(200)
  async session(@Req() request: Request) {
    const user = await this.authService.session(
      readCookie(request, REFRESH_COOKIE),
    );
    return { user: user ?? null };
  }
}

function requestContext(request: Request): AuthRequestContext {
  return {
    ...(request.get('user-agent')
      ? { userAgent: request.get('user-agent') }
      : {}),
    ...(request.ip ? { ipAddress: request.ip } : {}),
  };
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') {
    throw FinwiseError.validation('The request contains invalid credentials.');
  }
  return value;
}

function readField(value: unknown, field: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return field in value ? (value as Record<string, unknown>)[field] : undefined;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(valueParts.join('='));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function setRefreshCookie(response: Response, refreshToken: string): void {
  const refreshTtlSeconds = Number(process.env.FINWISE_REFRESH_TTL_SECONDS);
  const maxAge =
    Number.isSafeInteger(refreshTtlSeconds) &&
    refreshTtlSeconds >= 300 &&
    refreshTtlSeconds <= 90 * 24 * 60 * 60
      ? refreshTtlSeconds * 1000
      : 30 * 24 * 60 * 60 * 1000;
  response.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
