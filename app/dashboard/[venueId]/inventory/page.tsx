import InventoryClientPage from "./page.client";

export default async function InventoryPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [INVENTORY MANAGEMENT PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <InventoryClientPage venueId={venueId} />;
}
