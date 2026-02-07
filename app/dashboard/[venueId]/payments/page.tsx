import PaymentsClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function PaymentsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: !!auth,
    userId: auth?.user?.id,
    email: auth?.user?.email,
    tier: auth?.tier ?? "starter",
    role: auth?.role ?? "viewer",
    venueId: auth?.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "Payments",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <PaymentsClientPage
        venueId={venueId}
        tier={auth?.tier ?? "starter"}
        role={auth?.role ?? "viewer"}
      />
    </>
  );
}
