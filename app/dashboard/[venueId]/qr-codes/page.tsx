import dynamic from "next/dynamic";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

const QRCodeClientPage = dynamic(() => import("./page.client"), {

  loading: () => null, // No loading spinner - render immediately

export default async function QRCodePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check (even though client is SSR disabled)
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Render fully client-side with no SSR to prevent hydration issues
  return (
    <QRCodeClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
    />
  );
}
