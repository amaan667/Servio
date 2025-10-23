import KDSClientPage from "./page.client";

export default async function KDSPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

    venueId,
    timestamp: new Date().toISOString(),
  });

  // Render fully client-side to handle auth and data loading properly
  return <KDSClientPage venueId={venueId} />;
}
