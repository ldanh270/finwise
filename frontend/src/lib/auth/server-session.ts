import { cookies } from "next/headers";

const API_URL = (
  process.env.FINWISE_API_URL ??
  process.env.NEXT_PUBLIC_FINWISE_API_URL ??
  ""
).replace(/\/$/, "");

export interface ServerAuthUser {
  readonly id: string;
  readonly email: string;
  readonly displayName?: string;
}

export async function getFinwiseServerSession(): Promise<ServerAuthUser | null> {
  if (!API_URL) return null;
  const refreshToken = (await cookies()).get("finwise_refresh")?.value;
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${API_URL}/v1/auth/session`, {
      headers: {
        Cookie: `finwise_refresh=${encodeURIComponent(refreshToken)}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object") return null;
    const user = (payload as Record<string, unknown>).user;
    if (!user || typeof user !== "object") return null;
    const candidate = user as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.email !== "string"
    ) {
      return null;
    }
    return {
      id: candidate.id,
      email: candidate.email,
      ...(typeof candidate.displayName === "string"
        ? { displayName: candidate.displayName }
        : {}),
    };
  } catch {
    return null;
  }
}
