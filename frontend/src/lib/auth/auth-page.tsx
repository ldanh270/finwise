"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";

type AuthStep = "email" | "code";

const OTP_COOLDOWN_SECONDS = 30;

export default function AuthPage() {
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<
    | { readonly kind: "idle" }
    | { readonly kind: "loading" }
    | { readonly kind: "error"; readonly message: string }
    | { readonly kind: "success"; readonly message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const client = getSupabaseBrowserClient();
    if (!client) {
      setStatus({
        kind: "error",
        message:
          "Authentication is not configured for this environment. Add the Supabase public URL and anon key, then try again.",
      });
      return;
    }
    setStatus({ kind: "loading" });
    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });
    if (error) {
      setStatus({
        kind: "error",
        message: "We could not send a code. Check the email and try again.",
      });
      return;
    }
    setEmail(normalizedEmail);
    setStep("code");
    setCode("");
    setCooldown(OTP_COOLDOWN_SECONDS);
    setStatus({ kind: "success", message: "Code sent. Check your inbox." });
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) {
      setStatus({
        kind: "error",
        message: "Authentication is not configured for this environment.",
      });
      return;
    }
    setStatus({ kind: "loading" });
    const { error } = await client.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setStatus({
        kind: "error",
        message:
          "That code is invalid or expired. Request a new code and try again.",
      });
      return;
    }
    setStatus({
      kind: "success",
      message: "Signed in. Opening your workspace…",
    });
    window.location.assign("/");
  }

  async function resendCode() {
    if (cooldown > 0 || !email) return;
    await requestCode({
      preventDefault: () => undefined,
    } as FormEvent<HTMLFormElement>);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand" aria-hidden="true">
          <span className="auth-brand-mark">F</span>
          <span className="auth-brand-name">finwise</span>
          <span className="auth-brand-beta">BETA</span>
        </div>
        <div className="auth-heading">
          <span className="section-kicker">PRIVATE MONEY WORKSPACE</span>
          <h1 id="auth-title">
            {step === "email" ? "Welcome back" : "Check your email"}
          </h1>
          <p>
            {step === "email"
              ? "Sign in or create your workspace with a six-digit email code."
              : `Enter the six-digit code we sent to ${email}.`}
          </p>
        </div>

        {step === "email" ? (
          <form className="auth-form" onSubmit={requestCode}>
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={320}
            />
            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={status.kind === "loading"}
              aria-busy={status.kind === "loading"}
            >
              {status.kind === "loading"
                ? "Sending code…"
                : "Continue with email"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={verifyCode}>
            <label htmlFor="auth-code">Six-digit code</label>
            <input
              id="auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
              required
              autoFocus
            />
            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={status.kind === "loading"}
              aria-busy={status.kind === "loading"}
            >
              {status.kind === "loading"
                ? "Verifying…"
                : "Verify and open workspace"}
            </button>
            <div className="auth-secondary-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => setStep("email")}
              >
                Use a different email
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => void resendCode()}
                disabled={cooldown > 0 || status.kind === "loading"}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {status.kind === "error" ? (
          <p className="auth-feedback is-error" role="alert">
            {status.message}
          </p>
        ) : status.kind === "success" ? (
          <p className="auth-feedback" role="status">
            {status.message}
          </p>
        ) : null}

        <p className="auth-legal">
          By continuing, you agree to keep your workspace private and use
          Finwise only for your own authorized financial records.
        </p>
      </section>
    </main>
  );
}
