import SettingsClientPage from "./page.client";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  console.info("📍 [SETTINGS PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  return <SettingsClientPage venueId={venueId} />;
}
