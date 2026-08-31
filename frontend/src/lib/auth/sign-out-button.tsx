"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "./session";

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  async function signOut() {
    setIsSigningOut(true);
    await logout();
    router.push("/auth");
    router.refresh();
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
