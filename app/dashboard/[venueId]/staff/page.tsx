import StaffClientPage from "./page.client";

export default async function StaffPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

    venueId,
    timestamp: new Date().toISOString(),
  });

  return <StaffClientPage venueId={venueId} />;
}
