import { redirect } from "next/navigation";
import AuthPage from "../../src/lib/auth/auth-page";
import { getFinwiseServerSession } from "../../src/lib/auth/server-session";

export const dynamic = "force-dynamic";

export default async function AuthRoute() {
  const user = await getFinwiseServerSession();
  if (user) {
    redirect("/");
  }
  return <AuthPage />;
}
