import { redirect } from "next/navigation";
import AuthPage from "../../src/lib/auth/auth-page";
import { getSupabaseServerClient } from "../../src/lib/auth/supabase-server";

export const dynamic = "force-dynamic";

export default async function AuthRoute() {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/");
    }
  }
  return <AuthPage />;
}
