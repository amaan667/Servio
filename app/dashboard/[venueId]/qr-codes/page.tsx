import { Suspense } from "react";
import QRCodeClientPage from "./page.client";

export default async function QRCodePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [QR CODES PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  // Render fully client-side to handle auth and data loading properly
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }
    >
      <QRCodeClientPage venueId={venueId} />
    </Suspense>
  );
}
