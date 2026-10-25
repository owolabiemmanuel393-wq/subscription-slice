import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Screen 6: Dashboard (Protected Route)
 * Server-side session verification ensures unauthenticated requests are redirected.
 * Contains only:
 * - One line: "You are signed in"
 * - The user's name
 * - A Sign out button
 */
export default async function DashboardPage() {
  const sessionUser = await getSessionUser();

  // Enforce server-side route protection: signed-out users are sent directly to signin
  if (!sessionUser) {
    redirect("/signin");
  }

  return (
    <div className="auth-page-container">
      <div className="m3-dashboard-card">
        <p className="m3-dashboard-title">You are signed in</p>
        <p className="m3-dashboard-username">{sessionUser.user.name}</p>
        <SignOutButton />
      </div>
    </div>
  );
}
