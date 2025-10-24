import StaffClientPage from "./page.client";

export default async function StaffPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <StaffClientPage venueId={venueId} />;
}
