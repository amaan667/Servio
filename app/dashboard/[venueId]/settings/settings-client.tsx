"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthProvider";
import VenueSettingsClient from "./VenueSettingsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { User } from "@supabase/supabase-js";
import { useAuthRedirect } from "../hooks/useAuthRedirect";

interface Organization {
  id: string;
  subscription_tier?: string;
  [key: string]: unknown;
}

interface SettingsPageClientProps {
  venueId: string;
  initialData?: {
    user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
    venue: Record<string, unknown>;
    venues: Record<string, unknown>[];
    organization: Organization | null;
    isOwner: boolean;
    isManager: boolean;
    userRole: string;
  };
}

export default function SettingsPageClient({ venueId, initialData }: SettingsPageClientProps) {
  const router = useRouter();
  const { user, isLoading: authRedirectLoading } = useAuthRedirect();
  const { session, loading: authLoading } = useAuth(); // Get session from AuthProvider

  // Track if component has mounted to prevent hydration mismatches
  const [mounted, setMounted] = useState(false);

  // Fetch data on client if not provided by server
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  // Set mounted flag after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data effect - must be before early returns
  useEffect(() => {
    // If we have initial data, cache it (overwriting any stale cache)
    if (initialData && typeof window !== "undefined") {
      sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(initialData));
      return;
    }

    // Otherwise, fetch data on client (and skip cache since we fixed the query)
    const fetchData = async () => {
      try {
        // Wait for auth to finish loading
        if (authLoading || !mounted) {
          return;
        }

        // Use session from AuthProvider (already authenticated)
        const currentUser = session?.user;

        if (!currentUser) {
          setLoading(false);
          return;
        }

        const supabase = supabaseBrowser();

        // Fetch venues first to get organization_id
        const { data: venuesForOrg } = await supabase
          .from("venues")
          .select("organization_id")
          .eq("owner_user_id", currentUser.id)
          .limit(1);

        // Fetch organization
        let organization = null;
        if (venuesForOrg && venuesForOrg.length > 0 && venuesForOrg[0]?.organization_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
            .eq("id", venuesForOrg[0].organization_id)
            .single();

          if (orgData) {
            organization = orgData;
          }
        }

        // Fetch all required data
        const [venueResult, userRoleResult, allVenuesResult] = await Promise.all([
          supabase
            .from("venues")
            .select("*")
            .eq("venue_id", venueId)
            .eq("owner_user_id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("user_venue_roles")
            .select("role")
            .eq("user_id", currentUser.id)
            .eq("venue_id", venueId)
            .maybeSingle(),
          supabase
            .from("venues")
            .select("*")
            .eq("owner_user_id", currentUser.id)
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
          user: currentUser,
          venue: finalVenue,
          venues: allVenues,
          organization,
          isOwner,
          isManager,
          userRole: userRole?.role || (isOwner ? "owner" : "staff"),
        };

        setData(fetchedData);
        sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(fetchedData));
      } catch (_error) {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if mounted and no initial data
    if (mounted && !initialData) {
      fetchData();
    }
  }, [venueId, initialData, session, authLoading, mounted]);

  // Show loading while checking auth or before mount (prevents hydration mismatch)
  if (!mounted || authRedirectLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if no user (will redirect)
  if (!user) {
    return null;
  }

  // Show loading state while fetching
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no data after loading, wait for session or show minimal UI
  if (!data || !data.user || !data.venue) {
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
            <VenueSettingsClient
              user={data.user as User}
              venue={data.venue as unknown as import("./hooks/useVenueSettings").Venue}
              venues={data.venues as unknown as import("./hooks/useVenueSettings").Venue[]}
              organization={data.organization as Organization | undefined}
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
