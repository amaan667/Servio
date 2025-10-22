import QRCodeClientPage from "./page.client";

export default async function QRCodePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [QR CODES PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  // Render fully client-side to handle auth and data loading properly
  return <QRCodeClientPage venueId={venueId} />;
}
