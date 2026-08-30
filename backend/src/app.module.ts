import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';
import { CoreController } from './core/presentation/core.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [PrismaModule, AuthModule, CoreModule],
  controllers: [CoreController, HealthController],
})
export class AppModule {}
