import { Module } from '@nestjs/common';
import { CoreService } from './application/core.service';
import { InMemoryFinwiseStore } from './infrastructure/in-memory-finwise.store';
import { PrismaModule } from '../database/prisma.module';
import {
  createPersistentStore,
  PrismaRuntimeSnapshotRepository,
} from '../shared/infrastructure/prisma-runtime-snapshot.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaRuntimeSnapshotRepository,
    {
      provide: InMemoryFinwiseStore,
      inject: [PrismaRuntimeSnapshotRepository],
      useFactory: async (snapshots: PrismaRuntimeSnapshotRepository) => {
        const store = new InMemoryFinwiseStore();
        await snapshots.hydrate('core', store);
        return createPersistentStore(store, snapshots, 'core');
      },
    },
    {
      provide: CoreService,
      inject: [InMemoryFinwiseStore],
      useFactory: (store: InMemoryFinwiseStore) => new CoreService(store),
    },
  ],
  exports: [CoreService, InMemoryFinwiseStore, PrismaRuntimeSnapshotRepository],
})
export class CoreModule {}
