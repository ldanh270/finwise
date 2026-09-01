export type StableCommandKeyState = {
  readonly fingerprint: string;
  readonly key: string;
};

export function stableCommandKey(
  previous: StableCommandKeyState | undefined,
  prefix: string,
  payload: unknown,
): { readonly key: string; readonly state: StableCommandKeyState } {
  const fingerprint = JSON.stringify(payload);
  if (previous?.fingerprint === fingerprint) {
    return { key: previous.key, state: previous };
  }
  const key = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { key, state: { fingerprint, key } };
}
