import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
} from "react-native";
import { PrimaryButton, SecondaryButton, colors } from "./components";

export function AppLockGate({
  checking = false,
  error,
  onUnlock,
  onRecover,
}: {
  readonly checking?: boolean;
  readonly error?: string | null;
  readonly onUnlock?: () => void;
  readonly onRecover?: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.mark}>F</Text>
      {checking ? <ActivityIndicator color={colors.teal} size="large" /> : null}
      <Text style={styles.title}>
        {checking ? "Checking app lock…" : "Finwise is locked"}
      </Text>
      <Text style={styles.message}>
        {checking
          ? "Preparing your local biometric protection."
          : "Unlock with your device biometric to view private workspace data."}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {!checking && onUnlock ? (
        <PrimaryButton label="Unlock with biometrics" onPress={onUnlock} />
      ) : null}
      {!checking && onRecover ? (
        <SecondaryButton label="Use password instead" onPress={onRecover} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
    backgroundColor: colors.canvas,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    textAlign: "center",
    textAlignVertical: "center",
    color: colors.surface,
    backgroundColor: colors.teal,
    fontSize: 28,
    fontWeight: "800",
  },
  title: { color: colors.ink, fontSize: 23, fontWeight: "700" },
  message: {
    color: colors.muted,
    lineHeight: 20,
    maxWidth: 330,
    textAlign: "center",
  },
  error: { color: colors.danger, lineHeight: 19, textAlign: "center" },
});
