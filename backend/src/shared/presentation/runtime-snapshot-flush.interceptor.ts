import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, switchMap } from 'rxjs';
import { PrismaRuntimeSnapshotRepository } from '../infrastructure/prisma-runtime-snapshot.repository';

/**
 * Makes the runtime snapshot adapter a write-through boundary for HTTP writes.
 * The normalized Prisma repositories will replace this adapter before scale-out.
 */
@Injectable()
export class RuntimeSnapshotFlushInterceptor implements NestInterceptor {
  constructor(private readonly snapshots: PrismaRuntimeSnapshotRepository) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      switchMap(async (response: unknown) => {
        await this.snapshots.flush();
        return response;
      }),
    );
  }
}
