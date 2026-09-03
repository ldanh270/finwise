"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "./session";

export type AuthMode = "login" | "register";

export default function AuthPage({
  initialMode = "login",
}: {
  readonly initialMode?: AuthMode;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<
    | { readonly kind: "idle" }
    | { readonly kind: "loading" }
    | { readonly kind: "error"; readonly message: string }
  >({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "loading" });
    try {
      if (mode === "login") {
        await login({ email: email.trim(), password });
      } else {
        await register({
          email: email.trim(),
          password,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        });
      }
      router.push("/");
      router.refresh();
    } catch (error: unknown) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not authenticate you. Check your details and try again.",
      });
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStatus({ kind: "idle" });
    router.push(nextMode === "login" ? "/login" : "/signup");
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
            {mode === "login" ? "Welcome back" : "Create your workspace"}
          </h1>
          <p>
            {mode === "login"
              ? "Sign in to continue to your private financial workspace."
              : "Start with a secure personal workspace. You can invite others later."}
          </p>
        </div>

        <div
          className="auth-mode-switch"
          role="tablist"
          aria-label="Authentication mode"
        >
          <button
            className={mode === "login" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => switchMode("login")}
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            onClick={() => switchMode("register")}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <>
              <label htmlFor="auth-display-name">Display name (optional)</label>
              <input
                id="auth-display-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={120}
              />
            </>
          ) : null}
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
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            placeholder="At least 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === "register" ? 6 : undefined}
            maxLength={128}
          />
          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={status.kind === "loading"}
            aria-busy={status.kind === "loading"}
          >
            {status.kind === "loading"
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {status.kind === "error" ? (
          <p className="auth-feedback is-error" role="alert">
            {status.message}
          </p>
        ) : null}

        <p className="auth-legal">
          Passwords are hashed server-side and sessions use short-lived signed
          access tokens with rotated HTTP-only refresh cookies.
        </p>
      </section>
    </main>
  );
}
