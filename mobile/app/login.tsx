import { Link, router, useLocalSearchParams } from "expo-router";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../src/auth/auth-context";
import { resolvePostAuthPath } from "../src/navigation/deep-link";

export default function LoginRoute() {
  const { signIn, error } = useAuth();
  const { redirectPath } = useLocalSearchParams<{ redirectPath?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setFormError("Enter your email and password.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await signIn(email.trim(), password);
      router.replace(resolvePostAuthPath(redirectPath));
    } catch (submitError: unknown) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to sign in.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Sign in to continue to your private financial workspace."
      footer={
        <Text style={styles.footer}>
          New to Finwise?{" "}
          <Link
            href={
              redirectPath
                ? { pathname: "/signup", params: { redirectPath } }
                : "/signup"
            }
            style={styles.link}
          >
            Create an account
          </Link>
        </Text>
      }
    >
      <Field
        label="Email address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {(formError ?? error) ? (
        <Text style={styles.error}>{formError ?? error}</Text>
      ) : null}
      <PrimaryButton
        label={saving ? "Signing in…" : "Sign in"}
        disabled={saving}
        onPress={() => void submit()}
      />
    </AuthFrame>
  );
}

export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markText}>F</Text>
            </View>
            <Text style={styles.brandText}>finwise</Text>
            <Text style={styles.beta}>BETA</Text>
          </View>
          <Text style={styles.kicker}>PRIVATE MONEY WORKSPACE</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.form}>{children}</View>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Field(
  props: ComponentProps<typeof TextInput> & { label: string },
) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#9aa9a8"
        style={styles.input}
      />
    </View>
  );
}
export function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7faf9" },
  keyboard: { flex: 1, justifyContent: "center", padding: 20 },
  card: {
    borderRadius: 24,
    backgroundColor: "#fff",
    padding: 24,
    shadowColor: "#16433e",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 34,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#087f78",
  },
  markText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  brandText: { color: "#132f31", fontWeight: "800", fontSize: 20 },
  beta: {
    color: "#087f78",
    borderWidth: 1,
    borderColor: "#8ac3bd",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 9,
    fontWeight: "700",
  },
  kicker: {
    color: "#7f9290",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    color: "#173d3d",
    fontSize: 31,
    fontWeight: "600",
    letterSpacing: -0.7,
  },
  subtitle: { color: "#5e7370", lineHeight: 21, marginTop: 8 },
  form: { gap: 16, marginTop: 26 },
  field: { gap: 7 },
  label: { color: "#466764", fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#d6e3e1",
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    color: "#153536",
    backgroundColor: "#fbfdfc",
    fontSize: 16,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#087f78",
    marginTop: 2,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  error: { color: "#b34e4e", lineHeight: 19 },
  footer: {
    color: "#6e8582",
    textAlign: "center",
    marginTop: 22,
    fontSize: 13,
  },
  link: { color: "#087f78", fontWeight: "700" },
});
