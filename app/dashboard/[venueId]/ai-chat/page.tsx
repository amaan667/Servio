import AichatClientPage from "./page.client";

export default async function AichatPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [AI ASSISTANT PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <AichatClientPage venueId={venueId} />;
}
