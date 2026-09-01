/**
 * Resolves the API host used by the mobile runtime.
 *
 * An explicit URL always wins because physical devices need the developer
 * machine's LAN address (or a staging URL). Android emulators expose the host
 * machine through 10.0.2.2, while iOS simulators and web can use localhost.
 */
export function resolveMobileApiUrl(
  configuredUrl: string | undefined,
  platform: string,
): string {
  const normalizedConfiguredUrl = configuredUrl?.trim().replace(/\/$/, "");
  if (normalizedConfiguredUrl) return normalizedConfiguredUrl;

  return platform === "android"
    ? "http://10.0.2.2:3001"
    : "http://localhost:3001";
}
