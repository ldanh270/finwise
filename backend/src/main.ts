import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { FinwiseErrorFilter } from './shared/presentation/finwise-error.filter';
import { AuthenticatedRequest } from './auth/finwise-auth.guard';
import { requestIdFor } from './shared/presentation/request-id';
import { safeErrorMessage } from './shared/presentation/safe-log';
import { readRuntimeConfig } from './config/runtime-config';

async function bootstrap() {
  const config = readRuntimeConfig();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: config.frontendOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: false,
      whitelist: false,
      forbidUnknownValues: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = requestIdFor(request.header('x-request-id'));
    response.setHeader('x-request-id', requestId);
    (request as AuthenticatedRequest).requestId = requestId;
    next();
  });
  app.useGlobalFilters(new FinwiseErrorFilter());
  await app.listen(config.port);
}
bootstrap().catch((error: unknown) => {
  const message = safeErrorMessage(error);
  console.error(`Backend failed to start: ${message}`);
  process.exitCode = 1;
});
