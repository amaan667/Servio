import SettingsClientPage from "./page.client";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

    venueId,
    timestamp: new Date().toISOString(),
  });

  return <SettingsClientPage venueId={venueId} />;
}
