"use client";

import SettingsPageClient from "./settings-client";

export default function SettingsClientPage({ venueId }: { venueId: string }) {
  console.log("[SETTINGS PAGE CLIENT] 🔧 Rendering settings page client wrapper", { venueId });
  return <SettingsPageClient venueId={venueId} />;
}
