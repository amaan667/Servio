import AnalyticsClientPage from "./page.client";

export default async function AnalyticsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <AnalyticsClientPage venueId={venueId} />;
}
