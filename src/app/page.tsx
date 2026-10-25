import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

/**
 * Root route ("/")
 * As per specification:
 * Visiting "/" simply redirects to sign in or the dashboard depending on session status.
 */
export default async function HomePage() {
  const sessionUser = await getSessionUser();

  if (sessionUser) {
    redirect("/dashboard");
  } else {
    redirect("/signin");
  }
}
