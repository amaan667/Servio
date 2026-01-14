import InventoryClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function InventoryPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - NO REDIRECTS - Dashboard always loads
  const auth = await requirePageAuth(venueId).catch(() => null);

  return (
    <InventoryClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
    />
  );
}
