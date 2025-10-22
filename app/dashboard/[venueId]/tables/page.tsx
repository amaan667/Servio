import TablesClientPage from "./page.client";

export default async function TablesPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [TABLE MANAGEMENT PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <TablesClientPage venueId={venueId} />;
}
