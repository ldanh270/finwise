import { Module } from '@nestjs/common';
import { CoreService } from './application/core.service';
import { InMemoryFinwiseStore } from './infrastructure/in-memory-finwise.store';

@Module({
  providers: [
    InMemoryFinwiseStore,
    {
      provide: CoreService,
      inject: [InMemoryFinwiseStore],
      useFactory: (store: InMemoryFinwiseStore) => new CoreService(store),
    },
  ],
  exports: [CoreService, InMemoryFinwiseStore],
})
export class CoreModule {}
