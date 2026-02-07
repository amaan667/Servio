import dynamic from "next/dynamic";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

const QRCodeClientPage = dynamic(() => import("./page.client"), {
  ssr: false,
  loading: () => null,
});

export default async function QRCodePage({ params }: { params: { venueId: string } }) {
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
    page: "QR Codes",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <QRCodeClientPage
        venueId={venueId}
        tier={auth?.tier ?? "starter"}
        role={auth?.role ?? "viewer"}
      />
    </>
  );
}
