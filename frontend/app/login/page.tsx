import AuthPage from "../../src/lib/auth/auth-page";
import { getFinwiseServerSession } from "../../src/lib/auth/server-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginRoute() {
  const user = await getFinwiseServerSession();
  if (user) redirect("/");
  return <AuthPage initialMode="login" />;
}
