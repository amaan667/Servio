"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import VenueSettingsClient from "./VenueSettingsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";

export default function SettingsPageClient({ venueId }: { venueId: string }) {
  const router = useRouter();

  console.log("[SETTINGS CLIENT] 🎨 Component mounted/rendered", { venueId });

  // Check cache to prevent flicker
  const getCachedData = () => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(`settings_data_${venueId}`);
    const hasCached = !!cached;
    console.log("[SETTINGS CLIENT] 💾 Checking cache:", { hasCached });
    return cached ? JSON.parse(cached) : null;
  };

  const [data, setData] = useState<{
    user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
    venue: Record<string, unknown>;
    venues: Record<string, unknown>[];
    organization: Record<string, unknown> | null;
    isOwner: boolean;
    isManager: boolean;
    userRole: string;
  } | null>(getCachedData());
  const [loading, setLoading] = useState(!getCachedData());

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("[SETTINGS] 🚀 Starting to load settings data for venue:", venueId);
        setLoading(true);
        const supabase = supabaseBrowser();

        // Get session
        console.log("[SETTINGS] 📡 Fetching user session...");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          console.error("[SETTINGS] ❌ No user session found - user not authenticated");
          setLoading(false);
          return;
        }

        console.log("[SETTINGS] ✅ User authenticated:", {
          userId: user.id,
          email: user.email,
        });

        // Load all data
        console.log("[SETTINGS] 📊 Fetching venue data, roles, and organization...");
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
            .order("created_at", { ascending: false }),
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

        console.log("[SETTINGS] 📋 Query results:", {
          hasVenue: !!venueResult.data,
          venueError: venueResult.error?.message,
          hasUserRole: !!userRoleResult.data,
          userRole: userRoleResult.data?.role,
          userRoleError: userRoleResult.error?.message,
          allVenuesCount: allVenuesResult.data?.length || 0,
          allVenuesError: allVenuesResult.error?.message,
          hasOrganization: !!orgResult.data,
          organizationError: orgResult.error?.message,
        });

        const venue = venueResult.data;
        const userRole = userRoleResult.data;
        const allVenues = allVenuesResult.data || [];
        const organization = orgResult.data;

        const isOwner = !!venue;
        const isManager = userRole?.role === "manager";

        console.log("[SETTINGS] 🔐 Permission check:", {
          isOwner,
          isManager,
          userRole: userRole?.role,
        });

        let finalVenue = venue;
        if (!venue && isManager) {
          console.log("[SETTINGS] 👤 User is manager but not owner, fetching venue data...");
          const { data: managerVenue } = await supabase
            .from("venues")
            .select("*")
            .eq("venue_id", venueId)
            .single();
          finalVenue = managerVenue;
          console.log("[SETTINGS] ✅ Manager venue fetched:", !!managerVenue);
        }

        const settingsData = {
          user,
          venue: finalVenue,
          venues: allVenues,
          organization,
          isOwner,
          isManager,
          userRole: userRole?.role || (isOwner ? "owner" : "staff"),
        };

        console.log("[SETTINGS] 💾 Setting data state:", {
          hasVenue: !!finalVenue,
          venueName: finalVenue?.name,
          hasOrganization: !!organization,
          organizationId: organization?.id,
          subscriptionTier: organization?.subscription_tier,
          userRole: settingsData.userRole,
          venuesCount: allVenues.length,
        });

        setData(settingsData);

        // Cache settings data to prevent flicker
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(settingsData));
          console.log("[SETTINGS] ✅ Data cached to sessionStorage");
        }

        console.log("[SETTINGS] ✅ Settings loaded successfully!");
        setLoading(false);
      } catch (_error) {
        console.error("[SETTINGS] ❌ Error loading settings:", _error);
        console.error("[SETTINGS] Error details:", {
          message: _error instanceof Error ? _error.message : String(_error),
          stack: _error instanceof Error ? _error.stack : undefined,
        });
        setLoading(false);
      }
    };

    loadData();
  }, [venueId, router]);

  // Show loading state while fetching data
  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // If still no data after loading, show error
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Unable to Load Settings</h2>
          <p className="text-muted-foreground mb-6">
            There was a problem loading your settings. Please try refreshing the page.
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

  if (!data.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Sign in to continue</h2>
          <p className="text-muted-foreground mb-6">Please sign in to access venue settings.</p>
          <a
            href="/sign-in"
            className="inline-block bg-primary text-primary-foreground py-2 px-6 rounded-md hover:bg-primary/90 transition"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (!data.venue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div>You don&apos;t have access to this venue</div>
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
