import InventoryClientPage from "./page.client";

export default async function InventoryPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <InventoryClientPage venueId={venueId} />;
}
