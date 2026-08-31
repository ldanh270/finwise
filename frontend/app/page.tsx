import { redirect } from "next/navigation";
import DashboardPage from "../src/features/dashboard/dashboard-page";
import { getSupabaseServerClient } from "../src/lib/auth/supabase-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    redirect("/auth");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth");
  }
  return <DashboardPage />;
}
