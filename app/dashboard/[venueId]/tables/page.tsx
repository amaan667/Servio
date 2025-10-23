import TablesClientPage from "./page.client";

export default async function TablesPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;


  return <TablesClientPage venueId={venueId} />;
}
