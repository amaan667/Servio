"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import VenueSettingsClient from "./VenueSettingsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";

export default function SettingsPageClient({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
    venue: Record<string, unknown>;
    venues: Record<string, unknown>[];
    organization: Record<string, unknown> | null;
    isOwner: boolean;
    isManager: boolean;
    userRole: string;
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = supabaseBrowser();

        // Get session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          setLoading(false);
          return;
        }

        // Load all data
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
                    "id, subscription_tier, is_grandfathered, stripe_customer_id, subscription_status, trial_ends_at"
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
        const organization = orgResult.data;

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

        setData({
          user,
          venue: finalVenue,
          venues: allVenues,
          organization,
          isOwner,
          isManager,
          userRole: userRole?.role || (isOwner ? "owner" : "staff"),
        });
        setLoading(false);
      } catch (error) {
        console.error("Error loading settings:", error);
        setLoading(false);
      }
    };

    loadData();
  }, [venueId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.user) {
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

  const canAccessSettings = data.userRole === "owner" || data.userRole === "manager";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={data.userRole as "owner" | "manager" | "staff"}
          userName={data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "User"}
        />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Venue Settings</h1>
          <p className="text-lg text-foreground mt-2">Manage your venue settings and preferences</p>
        </div>

        {canAccessSettings ? (
          <VenueSettingsClient
            user={data.user}
            venue={data.venue}
            venues={data.venues}
            organization={data.organization}
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
