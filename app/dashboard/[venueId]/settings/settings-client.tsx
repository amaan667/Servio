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
  const router = useRouter();
  const { session, loading: authLoading } = useAuth(); // Get session from AuthProvider

  // Fetch data on client if not provided by server
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    // If we have initial data, cache it (overwriting any stale cache)
    if (initialData && typeof window !== "undefined") {
      console.log("[SETTINGS CLIENT] 🎯 Using initialData from server:", {
        hasOrganization: !!initialData.organization,
        organizationId: initialData.organization?.id,
        subscriptionTier: (initialData.organization as any)?.subscription_tier,
        fullOrganization: initialData.organization,
      });
      sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(initialData));
      return;
    }

    console.log("[SETTINGS CLIENT] ⚠️ No initialData - will fetch from client");

    // Otherwise, fetch data on client (and skip cache since we fixed the query)
    const fetchData = async () => {
      try {
        // Wait for auth to finish loading
        if (authLoading) {
          return;
        }

        // Use session from AuthProvider (already authenticated)
        const user = session?.user;

        if (!user) {
          console.error("[SETTINGS] ❌ No user from AuthProvider after loading!", {
            hasSession: !!session,
            authLoading,
          });
          setLoading(false);
          return;
        }

        const supabase = supabaseBrowser();

        // Fetch venues first to get organization_id
        const { data: venuesForOrg, error: venuesError } = await supabase
          .from("venues")
          .select("organization_id")
          .eq("owner_user_id", user.id)
          .limit(1);

        console.log("[SETTINGS CLIENT] 🔍 Venues query for organization:", {
          hasData: !!venuesForOrg,
          dataLength: venuesForOrg?.length,
          firstVenue: venuesForOrg?.[0],
          error: venuesError,
        });

        // Fetch organization
        let organization = null;
        if (venuesForOrg && venuesForOrg.length > 0 && venuesForOrg[0]?.organization_id) {
          console.log(
            "[SETTINGS CLIENT] 🔍 Fetching organization:",
            venuesForOrg[0].organization_id
          );
          const { data: orgData, error: orgError } = await supabase
            .from("organizations")
            .select("id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
            .eq("id", venuesForOrg[0].organization_id)
            .single();

          console.log("[SETTINGS CLIENT] 📥 Organization query result:", {
            hasData: !!orgData,
            data: orgData,
            error: orgError,
          });

          organization = orgData;
        } else {
          console.log("[SETTINGS CLIENT] ⚠️ No organization_id found in venues!");
        }

        // Fetch all required data
        const [venueResult, userRoleResult, allVenuesResult] = await Promise.all([
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
        ]);

        const venue = venueResult.data;
        const userRole = userRoleResult.data;
        const allVenues = allVenuesResult.data || [];

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

        console.log("[SETTINGS CLIENT] 📥 Fetched data from client-side:", {
          hasOrganization: !!organization,
          organizationId: (organization as any)?.id,
          subscriptionTier: (organization as any)?.subscription_tier,
          fullOrganization: organization,
        });

        setData(fetchedData);
        sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(fetchedData));
      } catch (error) {
        console.error("[SETTINGS] ❌ Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [venueId, initialData, session, authLoading]);

  // Show loading state while fetching
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no data after loading, wait for session or show minimal UI
  if (!data || !data.user || !data.venue) {
    // If still loading or auth loading, show spinner
    if (loading || authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      );
    }

    // If not loading but no data, show error
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Unable to Load Settings</h2>
          <p className="text-muted-foreground mb-6">
            Please try signing in again or contact support if the problem persists.
          </p>
          <button
            onClick={() => router.push("/sign-in")}
            className="inline-block bg-primary text-primary-foreground py-2 px-6 rounded-md hover:bg-primary/90 transition"
          >
            Sign In
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
          <>
            {console.log("[SETTINGS CLIENT] 🚀 Passing data to VenueSettingsClient:", {
              hasOrganization: !!data.organization,
              organizationId: (data.organization as any)?.id,
              subscriptionTier: (data.organization as any)?.subscription_tier,
              organizationObject: data.organization,
            })}
            <VenueSettingsClient
              user={data.user as any}
              venue={data.venue as any}
              venues={data.venues as any}
              organization={data.organization as any}
              isOwner={data.isOwner}
            />
          </>
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
