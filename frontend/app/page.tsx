import { redirect } from "next/navigation";
import DashboardPage from "../src/features/dashboard/dashboard-page";
import { getFinwiseServerSession } from "../src/lib/auth/server-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getFinwiseServerSession();
  if (!user) {
    redirect("/login");
  }
  return <DashboardPage />;
}
