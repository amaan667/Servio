import PosClientPage from "./page.client";

export default async function PosPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [POINT OF SALE PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <PosClientPage venueId={venueId} />;
}
