import FeedbackClientPage from "./page.client";

export default async function FeedbackPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <FeedbackClientPage venueId={venueId} />;
}
