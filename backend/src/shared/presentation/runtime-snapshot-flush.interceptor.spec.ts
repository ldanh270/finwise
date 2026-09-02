import { of } from 'rxjs';
import { RuntimeSnapshotFlushInterceptor } from './runtime-snapshot-flush.interceptor';

describe('RuntimeSnapshotFlushInterceptor', () => {
  it('flushes pending snapshot writes before returning the response', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const interceptor = new RuntimeSnapshotFlushInterceptor({ flush } as never);
    const response = await new Promise<unknown>((resolve, reject) => {
      interceptor
        .intercept({} as never, { handle: () => of({ ok: true }) })
        .subscribe({ next: resolve, error: reject });
    });

    expect(flush).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ ok: true });
  });

  it('propagates a persistence failure to the request pipeline', async () => {
    const failure = new Error('database unavailable');
    const interceptor = new RuntimeSnapshotFlushInterceptor({
      flush: jest.fn().mockRejectedValue(failure),
    } as never);

    await expect(
      new Promise<unknown>((resolve, reject) => {
        interceptor
          .intercept({} as never, { handle: () => of({ ok: true }) })
          .subscribe({ next: resolve, error: reject });
      }),
    ).rejects.toBe(failure);
  });
});
