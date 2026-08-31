import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from '../core/core.module';
import { IngestionService } from './application/ingestion.service';
import { InMemoryImportStore } from './infrastructure/in-memory-import.store';
import { IngestionController } from './presentation/ingestion.controller';
import { InMemoryFinwiseStore } from '../core/infrastructure/in-memory-finwise.store';

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [IngestionController],
  providers: [
    {
      provide: InMemoryImportStore,
      inject: [InMemoryFinwiseStore],
      useFactory: (ledger: InMemoryFinwiseStore) =>
        new InMemoryImportStore(ledger),
    },
    {
      provide: IngestionService,
      inject: [InMemoryImportStore],
      useFactory: (store: InMemoryImportStore) => new IngestionService(store),
    },
  ],
})
export class IngestionModule {}
