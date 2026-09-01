import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { InMemoryFinwiseStore } from '../core/infrastructure/in-memory-finwise.store';
import { GroupService } from './application/group.service';
import { InMemoryGroupStore } from './infrastructure/in-memory-group.store';
import { GroupController } from './presentation/group.controller';
import {
  createPersistentStore,
  PrismaRuntimeSnapshotRepository,
} from '../shared/infrastructure/prisma-runtime-snapshot.repository';

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [GroupController],
  providers: [
    {
      provide: InMemoryGroupStore,
      inject: [InMemoryFinwiseStore, PrismaRuntimeSnapshotRepository],
      useFactory: async (
        ledger: InMemoryFinwiseStore,
        snapshots: PrismaRuntimeSnapshotRepository,
      ) => {
        const store = new InMemoryGroupStore(ledger);
        await snapshots.hydrate('group', store);
        return createPersistentStore(store, snapshots, 'group');
      },
    },
    {
      provide: GroupService,
      inject: [InMemoryGroupStore],
      useFactory: (store: InMemoryGroupStore) => new GroupService(store),
    },
  ],
})
export class GroupModule {}
