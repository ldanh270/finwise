const SENSITIVE_KEY =
  /(?:access|refresh)?token|password|secret|authorization|cookie|otp|csvcontent|rawpayload|bankpayload/i;
const SENSITIVE_TEXT =
  /(bearer\s+|(?:access|refresh)?token|password|secret|authorization|cookie|otp|csvcontent|rawpayload|bankpayload)(\s*[:=]\s*|\s+)[^\s,;]+/gi;

export function redactSensitive(value: unknown, keyHint?: string): unknown {
  if (keyHint && SENSITIVE_KEY.test(keyHint)) return '[REDACTED]';
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      redactSensitive(nested, key),
    ]),
  );
}

export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return redactText(message);
}

function redactText(value: string): string {
  return value.replace(SENSITIVE_TEXT, '$1=[REDACTED]');
}
