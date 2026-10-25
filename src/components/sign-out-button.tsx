"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // ignore network failure on sign out
    } finally {
      router.push("/signin");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="m3-btn-outlined"
      aria-label="Sign out of GymLog"
      style={{ maxWidth: "200px" }}
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
