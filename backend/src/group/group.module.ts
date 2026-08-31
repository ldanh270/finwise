import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { InMemoryFinwiseStore } from '../core/infrastructure/in-memory-finwise.store';
import { GroupService } from './application/group.service';
import { InMemoryGroupStore } from './infrastructure/in-memory-group.store';
import { GroupController } from './presentation/group.controller';

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [GroupController],
  providers: [
    {
      provide: InMemoryGroupStore,
      inject: [InMemoryFinwiseStore],
      useFactory: (ledger: InMemoryFinwiseStore) =>
        new InMemoryGroupStore(ledger),
    },
    {
      provide: GroupService,
      inject: [InMemoryGroupStore],
      useFactory: (store: InMemoryGroupStore) => new GroupService(store),
    },
  ],
})
export class GroupModule {}
