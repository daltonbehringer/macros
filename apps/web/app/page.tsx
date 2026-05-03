import { cookies } from "next/headers";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/landing/Landing";

// Server-side gate: cookie present → render the dashboard inline; absent →
// render the public landing. The session cookie is HttpOnly so the only place
// to read it is the server. We don't validate the cookie here — Dashboard's
// own /me call still authoritatively fails with 401 and bounces to /login if
// the session is stale or revoked.
export default async function HomePage() {
  const cookieStore = await cookies();
  const authenticated = cookieStore.has("macros_session");
  return authenticated ? <Dashboard /> : <Landing />;
}
