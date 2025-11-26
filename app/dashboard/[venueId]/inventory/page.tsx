import InventoryClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function InventoryPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - Inventory requires Pro+ tier
  const auth = await requirePageAuth(venueId, {
    requireFeature: "inventory",
  });

  const hasInventoryAccess = auth.hasFeatureAccess("inventory");

  return (
    <InventoryClientPage
      venueId={venueId}
      tier={auth.tier}
      role={auth.role}
      hasAccess={hasInventoryAccess}
    />
  );
}
