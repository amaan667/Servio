import AnalyticsClientPage from "./page.client";

export default async function AnalyticsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

    venueId,
    timestamp: new Date().toISOString(),
  });

  return <AnalyticsClientPage venueId={venueId} />;
}
