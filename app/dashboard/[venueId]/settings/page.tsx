import SettingsPageClient from "./settings-client";

export default async function VenueSettings({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Render fully client-side to handle auth and data loading
  return <SettingsPageClient venueId={venueId} />;
}
