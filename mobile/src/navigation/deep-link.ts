export const DEFAULT_POST_AUTH_PATH = "/(app)" as const;

export type PostAuthPath =
  | "/(app)"
  | "/(app)/accounts"
  | "/(app)/transactions"
  | "/(app)/budgets"
  | "/(app)/reports"
  | "/(app)/group"
  | "/(app)/inbox"
  | "/(app)/settings"
  | "/(app)/transaction/new";

const publicRouteMap: Readonly<Record<string, PostAuthPath>> = {
  "/": DEFAULT_POST_AUTH_PATH,
  "/accounts": "/(app)/accounts",
  "/transactions": "/(app)/transactions",
  "/budgets": "/(app)/budgets",
  "/reports": "/(app)/reports",
  "/group": "/(app)/group",
  "/inbox": "/(app)/inbox",
  "/settings": "/(app)/settings",
  "/transaction/new": "/(app)/transaction/new",
};

const internalPaths = new Set<PostAuthPath>([
  DEFAULT_POST_AUTH_PATH,
  "/(app)/accounts",
  "/(app)/transactions",
  "/(app)/budgets",
  "/(app)/reports",
  "/(app)/group",
  "/(app)/inbox",
  "/(app)/settings",
  "/(app)/transaction/new",
]);

/**
 * Keeps post-auth redirects inside the known Finwise route tree. Deep links
 * are user-controlled input and must never become an external navigation URL.
 */
export function resolvePostAuthPath(value: string | undefined): PostAuthPath {
  if (!value) return DEFAULT_POST_AUTH_PATH;
  const decoded = decodePath(value);
  if (internalPaths.has(decoded as PostAuthPath)) {
    return decoded as PostAuthPath;
  }
  return publicRouteMap[decoded] ?? DEFAULT_POST_AUTH_PATH;
}

/** Return a safe internal path to carry through the login redirect query. */
export function protectedPathForLogin(
  value: string | undefined,
): PostAuthPath | undefined {
  if (!value) return undefined;
  const decoded = decodePath(value);
  return internalPaths.has(decoded as PostAuthPath)
    ? (decoded as PostAuthPath)
    : publicRouteMap[decoded];
}

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
