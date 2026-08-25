import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_BACKEND_PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? DEFAULT_BACKEND_PORT);
}
bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown startup error';
  console.error(`Backend failed to start: ${message}`);
  process.exitCode = 1;
});
