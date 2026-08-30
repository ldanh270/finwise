import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { FinwiseErrorFilter } from './shared/presentation/finwise-error.filter';
import { AuthenticatedRequest } from './auth/finwise-auth.guard';

const DEFAULT_BACKEND_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  const allowedOrigins = (
    process.env.FRONTEND_ORIGINS ?? 'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: false,
      whitelist: false,
      forbidUnknownValues: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestIdHeader = request.header('x-request-id');
    const requestId = requestIdHeader?.trim() || randomUUID();
    response.setHeader('x-request-id', requestId);
    (request as AuthenticatedRequest).requestId = requestId;
    next();
  });
  app.useGlobalFilters(new FinwiseErrorFilter());
  await app.listen(process.env.PORT ?? DEFAULT_BACKEND_PORT);
}
bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown startup error';
  console.error(`Backend failed to start: ${message}`);
  process.exitCode = 1;
});
