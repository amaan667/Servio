import DashboardClient from "./page.client";

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Client-side handles all data fetching with proper auth context
  // Server-side fetch causes issues with RLS and auth
  return <DashboardClient venueId={venueId} />;
}
