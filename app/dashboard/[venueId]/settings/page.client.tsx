"use client";

import SettingsPageClient from "./settings-client";
import type { User } from "@supabase/supabase-js";

interface SettingsClientPageProps {
  venueId: string;
  initialUser?: User;
}

export default function SettingsClientPage({ venueId, initialUser }: SettingsClientPageProps) {
  console.log("[SETTINGS PAGE CLIENT] 🔧 Rendering settings page client wrapper", {
    venueId,
    hasInitialUser: !!initialUser,
  });
  return <SettingsPageClient venueId={venueId} initialUser={initialUser} />;
}
