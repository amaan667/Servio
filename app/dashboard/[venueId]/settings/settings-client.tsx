"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import VenueSettingsClient from "./VenueSettingsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { User } from "@supabase/supabase-js";

interface SettingsPageClientProps {
  venueId: string;
  initialData: {
    user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
    venue: Record<string, unknown>;
    venues: Record<string, unknown>[];
    organization: Record<string, unknown> | null;
    isOwner: boolean;
    isManager: boolean;
    userRole: string;
  };
}

export default function SettingsPageClient({ venueId, initialData }: SettingsPageClientProps) {
  console.log("[SETTINGS PAGE] 🚀 Settings page component mounted with server data", {
    venueId,
    hasVenue: !!initialData.venue,
    userRole: initialData.userRole,
  });
  const router = useRouter();

  // Use server-provided data directly - no need to fetch on client!
  const [data] = useState(initialData);

  useEffect(() => {
    // Cache the server-provided data
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(initialData));
      console.log("[SETTINGS] 💾 Server data cached to sessionStorage");
    }
  }, [venueId, initialData]);

  // Data is provided by server, should always be valid
  // If somehow missing, this is a critical error
  if (!data || !data.user || !data.venue) {
    console.error("[SETTINGS] ❌ Critical: Missing required data from server", { data });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Settings</h2>
          <p className="text-muted-foreground mb-6">
            A critical error occurred. Please try refreshing the page or contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-block bg-primary text-primary-foreground py-2 px-6 rounded-md hover:bg-primary/90 transition"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const canAccessSettings = data?.userRole === "owner" || data?.userRole === "manager";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={data.userRole as "owner" | "manager" | "staff"}
          userName={
            (typeof data.user.user_metadata?.full_name === "string"
              ? data.user.user_metadata.full_name
              : null) ||
            data.user.email?.split("@")[0] ||
            "User"
          }
        />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Venue Settings</h1>
          <p className="text-lg text-foreground mt-2">Manage your venue settings and preferences</p>
        </div>

        {canAccessSettings ? (
          <VenueSettingsClient
            user={data.user as any}
            venue={data.venue as any}
            venues={data.venues as any}
            organization={data.organization as any}
            isOwner={data.isOwner}
          />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Access Restricted</h3>
            <p className="text-yellow-700">
              You don&apos;t have permission to access settings. This feature is available for Owner
              and Manager roles only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
