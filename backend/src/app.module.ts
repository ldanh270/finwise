import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';
import { CoreController } from './core/presentation/core.controller';
import { GroupModule } from './group/group.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { HealthController } from './health/health.controller';
import { RuntimeSnapshotFlushInterceptor } from './shared/presentation/runtime-snapshot-flush.interceptor';

@Module({
  imports: [PrismaModule, AuthModule, CoreModule, GroupModule, IngestionModule],
  controllers: [CoreController, HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RuntimeSnapshotFlushInterceptor,
    },
  ],
})
export class AppModule {}
