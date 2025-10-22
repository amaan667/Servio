import LiveOrdersClientPage from "./page.client";

export default async function LiveOrdersPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [LIVE ORDERS PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  // Render fully client-side to handle auth and data loading properly
  return <LiveOrdersClientPage venueId={venueId} />;
}
