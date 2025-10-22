import FeedbackClientPage from "./page.client";

export default async function FeedbackPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [CUSTOMER FEEDBACK PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <FeedbackClientPage venueId={venueId} />;
}
