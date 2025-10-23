import InventoryClientPage from "./page.client";

export default async function InventoryPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

    venueId,
    timestamp: new Date().toISOString(),
  });

  return <InventoryClientPage venueId={venueId} />;
}
