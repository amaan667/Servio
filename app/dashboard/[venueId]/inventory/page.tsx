import InventoryClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function InventoryPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - Inventory requires Pro+ tier
  const auth = await requirePageAuth(venueId, {

  }).catch(() => null);

  const hasInventoryAccess = auth?.hasFeatureAccess("inventory") ?? false;

  return (
    <InventoryClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
      hasAccess={hasInventoryAccess}
    />
  );
}
