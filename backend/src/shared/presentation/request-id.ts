import { randomUUID } from 'node:crypto';

export function requestIdFor(
  headerValue: string | undefined,
  createFallback: () => string = randomUUID,
): string {
  const requestedId = headerValue?.trim();
  return requestedId && /^[A-Za-z0-9._:-]{1,100}$/.test(requestedId)
    ? requestedId
    : createFallback();
}
