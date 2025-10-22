import DashboardClient from "./page.client";

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("🏠 [DASHBOARD PAGE] Main dashboard page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  // Render fully client-side to handle auth and data loading properly
  return <DashboardClient venueId={venueId} />;
}
