import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from '../core/core.module';
import {
  PrismaRuntimeSnapshotRepository,
  createPersistentStore,
} from '../shared/infrastructure/prisma-runtime-snapshot.repository';
import { InMemoryWealthStore } from './infrastructure/in-memory-wealth.store';
import { WealthService } from './application/wealth.service';
import { WealthController } from './presentation/wealth.controller';

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [WealthController],
  providers: [
    {
      provide: InMemoryWealthStore,
      inject: [PrismaRuntimeSnapshotRepository],
      useFactory: async (snapshots: PrismaRuntimeSnapshotRepository) => {
        const store = new InMemoryWealthStore();
        await snapshots.hydrate('wealth', store);
        return createPersistentStore(store, snapshots, 'wealth');
      },
    },
    {
      provide: WealthService,
      inject: [InMemoryWealthStore],
      useFactory: (store: InMemoryWealthStore) => new WealthService(store),
    },
  ],
})
export class WealthModule {}
