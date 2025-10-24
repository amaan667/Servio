import PosClientPage from "./page.client";

export default async function PosPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <PosClientPage venueId={venueId} />;
}
