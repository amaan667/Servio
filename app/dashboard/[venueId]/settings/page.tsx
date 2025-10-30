import SettingsClientPage from "./page.client";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // No server-side auth checks - let client handle everything for instant loading
  return <SettingsClientPage venueId={venueId} />;
}
