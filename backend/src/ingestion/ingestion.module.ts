import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from '../core/core.module';
import { IngestionService } from './application/ingestion.service';
import { InMemoryImportStore } from './infrastructure/in-memory-import.store';
import { IngestionController } from './presentation/ingestion.controller';
import { InMemoryFinwiseStore } from '../core/infrastructure/in-memory-finwise.store';
import {
  createPersistentStore,
  PrismaRuntimeSnapshotRepository,
} from '../shared/infrastructure/prisma-runtime-snapshot.repository';

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [IngestionController],
  providers: [
    {
      provide: InMemoryImportStore,
      inject: [InMemoryFinwiseStore, PrismaRuntimeSnapshotRepository],
      useFactory: async (
        ledger: InMemoryFinwiseStore,
        snapshots: PrismaRuntimeSnapshotRepository,
      ) => {
        const store = new InMemoryImportStore(ledger);
        await snapshots.hydrate('ingestion', store);
        return createPersistentStore(store, snapshots, 'ingestion');
      },
    },
    {
      provide: IngestionService,
      inject: [InMemoryImportStore],
      useFactory: (store: InMemoryImportStore) => new IngestionService(store),
    },
  ],
})
export class IngestionModule {}
