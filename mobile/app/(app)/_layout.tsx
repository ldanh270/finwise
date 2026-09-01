import { Redirect, Stack } from "expo-router";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
} from "react-native";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";
import { PrimaryButton, colors } from "../../src/ui/components";

export default function AuthenticatedLayout() {
  const { status } = useAuth();
  const { bootstrapStatus, bootstrapError, retryBootstrap } = useWorkspace();
  if (status === "restoring") return null;
  if (status !== "authenticated") return <Redirect href="/login" />;
  if (bootstrapStatus === "loading") return <BootstrapGate kind="loading" />;
  if (bootstrapStatus === "empty") return <BootstrapGate kind="empty" />;
  if (bootstrapStatus === "error") {
    return (
      <BootstrapGate
        kind="error"
        message={
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Your workspace could not be loaded."
        }
        onRetry={() => void retryBootstrap()}
      />
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

function BootstrapGate({
  kind,
  message,
  onRetry,
}: {
  kind: "loading" | "empty" | "error";
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      {kind === "loading" ? (
        <ActivityIndicator color={colors.teal} size="large" />
      ) : null}
      <Text style={styles.title}>
        {kind === "loading"
          ? "Loading your workspace…"
          : kind === "empty"
            ? "No workspace available"
            : "Workspace unavailable"}
      </Text>
      <Text
        accessibilityRole={kind === "error" ? "alert" : undefined}
        style={styles.message}
      >
        {message ??
          (kind === "loading"
            ? "Your private financial data will appear after access is confirmed."
            : kind === "empty"
              ? "Create or join a workspace before using Finwise."
              : "Check your connection and try again.")}
      </Text>
      {onRetry ? <PrimaryButton label="Retry" onPress={onRetry} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: colors.canvas,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: { color: colors.muted, lineHeight: 20, textAlign: "center" },
});
