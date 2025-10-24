import SettingsClientPage from "./page.client";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  return <SettingsClientPage venueId={venueId} />;
}
