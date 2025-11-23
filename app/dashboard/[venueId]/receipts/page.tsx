import ReceiptsClientPage from "./page.client";

export default async function ReceiptsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <ReceiptsClientPage venueId={venueId} />;
}
