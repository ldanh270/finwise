import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { hydrateStoreState, serializeStoreState } from './runtime-store-state';

@Injectable()
export class PrismaRuntimeSnapshotRepository implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaRuntimeSnapshotRepository.name);
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly writeFailures: unknown[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async hydrate(namespace: string, store: object): Promise<void> {
    if (!this.prisma.finwiseRuntimeSnapshot) return;
    const snapshot = await this.prisma.finwiseRuntimeSnapshot.findUnique({
      where: { namespace },
      select: { state: true },
    });
    if (snapshot) hydrateStoreState(store, snapshot.state);
  }

  persist(namespace: string, store: object): void {
    if (!this.prisma.finwiseRuntimeSnapshot) return;
    const state = serializeStoreState(
      store,
    ) as unknown as Prisma.InputJsonValue;
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        await this.prisma.finwiseRuntimeSnapshot.upsert({
          where: { namespace },
          create: { namespace, state, version: 1 },
          update: { state, version: 1, updatedAt: new Date() },
        });
      })
      .catch((error: unknown) => {
        this.writeFailures.push(error);
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Could not persist ${namespace} store snapshot: ${message}`,
        );
      });
  }

  async flush(): Promise<void> {
    await this.writeQueue;
    if (this.writeFailures.length === 0) return;

    const [firstFailure] = this.writeFailures.splice(0);
    throw firstFailure;
  }

  async onModuleDestroy(): Promise<void> {
    await this.flush();
  }
}

export function createPersistentStore<T extends object>(
  store: T,
  snapshots: PrismaRuntimeSnapshotRepository,
  namespace: string,
): T {
  return new Proxy(store, {
    get(target, property, receiver) {
      const member = Reflect.get(target, property, receiver);
      if (typeof member !== 'function') return member;
      return (...args: unknown[]) => {
        const callable = member as (...callArgs: unknown[]) => unknown;
        const invoke = Reflect.apply as unknown as (
          target: (...callArgs: unknown[]) => unknown,
          thisArg: unknown,
          argumentsList: readonly unknown[],
        ) => unknown;
        const result = invoke(callable, target, args);
        snapshots.persist(namespace, target);
        return result;
      };
    },
  });
}
