const LOCAL_DEVELOPMENT_API_URL = "http://localhost:3001";

export function getClientApiUrl(): string {
  return resolveApiUrl(process.env.NEXT_PUBLIC_FINWISE_API_URL);
}

export function getServerApiUrl(): string {
  return resolveApiUrl(
    process.env.FINWISE_API_URL ?? process.env.NEXT_PUBLIC_FINWISE_API_URL,
  );
}

function resolveApiUrl(configuredUrl: string | undefined): string {
  const normalizedUrl = configuredUrl?.trim().replace(/\/$/, "");
  if (normalizedUrl) return normalizedUrl;
  if (process.env.NODE_ENV !== "production") {
    return LOCAL_DEVELOPMENT_API_URL;
  }
  return "";
}
