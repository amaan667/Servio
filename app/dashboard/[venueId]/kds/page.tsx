import KDSClientPage from "./page.client";

export default async function KDSPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Render fully client-side to handle auth and data loading properly
  return <KDSClientPage venueId={venueId} />;
}
