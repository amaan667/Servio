"use client";

import SettingsPageClient from "./settings-client";

interface SettingsClientPageProps {
  venueId: string;
  initialData?: {
    user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
    venue: Record<string, unknown>;
    venues: Record<string, unknown>[];
    organization: Record<string, unknown> | null;
    isOwner: boolean;
    isManager: boolean;
    userRole: string;
  };
}

export default function SettingsClientPage({ venueId, initialData }: SettingsClientPageProps) {
  // Client will fetch data if initialData not provided
  return <SettingsPageClient venueId={venueId} initialData={initialData} />;
}
