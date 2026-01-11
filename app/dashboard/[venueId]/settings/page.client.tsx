"use client";

import SettingsPageClient from "./settings-client";

interface Organization {

}

interface SettingsClientPageProps {

    user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
    venue: Record<string, unknown>;
    venues: Record<string, unknown>[];

  };
}

export default function SettingsClientPage({ venueId, initialData }: SettingsClientPageProps) {
  // Client will fetch data if initialData not provided
  return <SettingsPageClient venueId={venueId} initialData={initialData} />;
}
