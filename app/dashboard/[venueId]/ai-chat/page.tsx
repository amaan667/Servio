import AichatClientPage from "./page.client";

export default async function AichatPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <AichatClientPage venueId={venueId} />;
}
