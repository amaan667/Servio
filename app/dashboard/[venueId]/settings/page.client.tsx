"use client";

import SettingsPageClient from "./settings-client";

export default function SettingsClientPage({ venueId }: { venueId: string }) {
  return <SettingsPageClient venueId={venueId} />;
}
