"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthProvider";
import VenueSettingsClient from "./VenueSettingsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { User } from "@supabase/supabase-js";

interface SettingsPageClientProps {
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

export default function SettingsPageClient({ venueId, initialData }: SettingsPageClientProps) {
  console.log("[SETTINGS PAGE] 🚀 Settings page component mounted", {
    venueId,
    hasInitialData: !!initialData,
  });
  const router = useRouter();
  const { session } = useAuth(); // Get session from AuthProvider

  // Fetch data on client if not provided by server
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    // If we have initial data, cache it
    if (initialData && typeof window !== "undefined") {
      sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(initialData));
      console.log("[SETTINGS] 💾 Server data cached to sessionStorage");
      return;
    }

    // Otherwise, fetch data on client
    const fetchData = async () => {
      try {
        // Check cache first
        const cached = sessionStorage.getItem(`settings_data_${venueId}`);
        if (cached) {
          console.log("[SETTINGS] 📦 Using cached data");
          setData(JSON.parse(cached));
          setLoading(false);
          return;
        }

        console.log("[SETTINGS] 🔄 Fetching data on client...");

        // Use session from AuthProvider (already authenticated)
        const user = session?.user;

        if (!user) {
          console.log("[SETTINGS] ℹ️ No user session from AuthProvider - waiting...");
          setLoading(false);
          return;
        }

        console.log("[SETTINGS] ✅ Using user from AuthProvider:", user.id);
        const supabase = supabaseBrowser();

        // Fetch all required data
        const [venueResult, userRoleResult, allVenuesResult, orgResult] = await Promise.all([
          supabase
            .from("venues")
            .select("*")
            .eq("venue_id", venueId)
            .eq("owner_user_id", user.id)
            .maybeSingle(),
          supabase
            .from("user_venue_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("venue_id", venueId)
            .maybeSingle(),
          supabase
            .from("venues")
            .select("*")
            .eq("owner_user_id", user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("venues")
            .select("organization_id")
            .eq("venue_id", venueId)
            .single()
            .then(async (result) => {
              if (result.data?.organization_id) {
                return supabase
                  .from("organizations")
                  .select(
                    "id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at"
                  )
                  .eq("id", result.data.organization_id)
                  .single();
              }
              return { data: null };
            }),
        ]);

        const venue = venueResult.data;
        const userRole = userRoleResult.data;
        const allVenues = allVenuesResult.data || [];
        const organization = "error" in orgResult ? null : orgResult.data;

        const isOwner = !!venue;
        const isManager = userRole?.role === "manager";

        let finalVenue = venue;
        if (!venue && isManager) {
          const { data: managerVenue } = await supabase
            .from("venues")
            .select("*")
            .eq("venue_id", venueId)
            .single();
          finalVenue = managerVenue;
        }

        const fetchedData = {
          user,
          venue: finalVenue,
          venues: allVenues,
          organization,
          isOwner,
          isManager,
          userRole: userRole?.role || (isOwner ? "owner" : "staff"),
        };

        setData(fetchedData);
        sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(fetchedData));
        console.log("[SETTINGS] ✅ Data fetched and cached");
      } catch (error) {
        console.error("[SETTINGS] ❌ Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [venueId, initialData, session]);

  // Show loading state while fetching
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no data after loading, show error
  if (!data || !data.user || !data.venue) {
    console.error("[SETTINGS] ❌ Missing required data", { data });
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
