import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { useAuth } from "../src/auth/auth-context";
import { AuthFrame, Field, PrimaryButton } from "./login";
import { resolvePostAuthPath } from "../src/navigation/deep-link";

export default function SignupRoute() {
  const { signUp, error } = useAuth();
  const { redirectPath } = useLocalSearchParams<{ redirectPath?: string }>();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!displayName.trim() || !email.trim() || password.length < 12) {
      setFormError(
        "Add your name, a valid email, and a password of at least 12 characters.",
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await signUp(displayName.trim(), email.trim(), password);
      router.replace(resolvePostAuthPath(redirectPath));
    } catch (submitError: unknown) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create your account.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthFrame
      title="Create your workspace"
      subtitle="Start with a private personal workspace. You can invite people later."
      footer={
        <Text
          style={{
            color: "#6e8582",
            textAlign: "center",
            marginTop: 22,
            fontSize: 13,
          }}
        >
          Already a member?{" "}
          <Link
            href={
              redirectPath
                ? { pathname: "/login", params: { redirectPath } }
                : "/login"
            }
            style={{ color: "#087f78", fontWeight: "700" }}
          >
            Sign in
          </Link>
        </Text>
      }
    >
      <Field
        label="Your name"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />
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
        <Text style={{ color: "#b34e4e", lineHeight: 19 }}>
          {formError ?? error}
        </Text>
      ) : null}
      <PrimaryButton
        label={saving ? "Creating…" : "Create account"}
        disabled={saving}
        onPress={() => void submit()}
      />
    </AuthFrame>
  );
}
