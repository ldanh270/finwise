import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  status(): { readonly status: 'ok'; readonly service: 'finwise-api' } {
    return { status: 'ok', service: 'finwise-api' };
  }

  @Get('live')
  live(): {
    readonly status: 'ok';
    readonly service: 'finwise-api';
    readonly version: string;
  } {
    return {
      status: 'ok',
      service: 'finwise-api',
      version: process.env.FINWISE_BUILD_VERSION ?? 'dev',
    };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<{
    readonly status: 'ok' | 'not_ready';
    readonly service: 'finwise-api';
    readonly checks: { readonly database: 'ok' | 'not_configured' | 'failed' };
  }> {
    if (!process.env.DATABASE_URL) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: 'not_ready',
        service: 'finwise-api',
        checks: { database: 'not_configured' },
      };
    }
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'finwise-api',
        checks: { database: 'ok' },
      };
    } catch {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: 'not_ready',
        service: 'finwise-api',
        checks: { database: 'failed' },
      };
    }
  }
}
