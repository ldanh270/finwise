"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      window.location.assign("/auth");
      return;
    }
    setIsSigningOut(true);
    await client.auth.signOut();
    window.location.assign("/auth");
  }

  return (
    <button
      className="icon-button"
      type="button"
      aria-label="Sign out"
      onClick={() => void signOut()}
      disabled={isSigningOut}
      title="Sign out"
    >
      {isSigningOut ? "…" : "↪"}
    </button>
  );
}
