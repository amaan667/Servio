import { PerformanceDashboardClient } from "./PerformanceDashboardClient";
import { getAuthContext } from "@/lib/auth/get-auth-context";

export default async function PerformancePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await getAuthContext(venueId);

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: auth.isAuthenticated,
    userId: auth.userId,
    email: auth.email,
    tier: auth.tier ?? "starter",
    role: auth.role ?? "viewer",
    venueId: auth.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "Performance",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <PerformanceDashboardClient venueId={venueId} />
    </>
  );
}
