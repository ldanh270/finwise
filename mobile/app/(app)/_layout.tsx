import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../src/auth/auth-context";

export default function AuthenticatedLayout() {
  const { status } = useAuth();
  if (status === "restoring") return null;
  if (status !== "authenticated") return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
