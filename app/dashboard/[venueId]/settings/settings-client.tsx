"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthProvider";
import VenueSettingsClient from "./VenueSettingsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { User } from "@supabase/supabase-js";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useAccessContext } from "@/lib/access/useAccessContext";

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
  const { user } = useAuthRedirect();
  const { session } = useAuth();

  // Single source of truth: get_access_context RPC via useAccessContext hook.
  // This replaces all the duplicate role/tier queries that were here before.
  const { context: accessContext, loading: accessLoading } = useAccessContext(venueId);

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When initialData is provided by the server, use it directly.
  // When NOT provided, fetch only the venue/org display data client-side.
  // Role/tier come from useAccessContext (single source of truth).
  useEffect(() => {
    if (initialData && typeof window !== "undefined") {
      sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(initialData));
      return;
    }

    const fetchData = async () => {
      try {
        if (!mounted) return;

        const currentUser = session?.user;
        if (!currentUser) {
          setLoading(false);
          return;
        }

        const supabase = supabaseBrowser();

        // Fetch the venue and all owned venues (for the settings UI)
        const [venueResult, allVenuesResult] = await Promise.all([
          supabase.from("venues").select("*").eq("venue_id", venueId).maybeSingle(),
          supabase
            .from("venues")
            .select("*")
            .eq("owner_user_id", currentUser.id)
            .order("created_at", { ascending: true }),
        ]);

        // Fetch organization for billing display
        let organization: Organization | null = null;
        const venue = venueResult.data;
        if (venue?.organization_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select(
              "id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at"
            )
            .eq("id", venue.organization_id)
            .single();
          organization = orgData || null;
        }

        // Role comes from useAccessContext — no duplicate role queries
        const role = accessContext?.role ?? "staff";
        const isOwner = role === "owner";
        const isManager = role === "manager";

        const fetchedData = {
          user: currentUser,
          venue,
          venues: allVenuesResult.data || [],
          organization,
          isOwner,
          isManager,
          userRole: role,
        };

        setData(fetchedData);
        sessionStorage.setItem(`settings_data_${venueId}`, JSON.stringify(fetchedData));
      } catch {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    };

    if (mounted && !initialData) {
      fetchData();
    }
  }, [venueId, initialData, session, mounted, accessContext]);

  if (!mounted) {
    return null;
  }

  if (!user) {
    return null;
  }

  // Determine access from TWO sources (whichever is available first):
  // 1. initialData.userRole — server-side resolved from admin DB query
  // 2. accessContext.role — client-side resolved from get_access_context RPC
  // Both ultimately come from the database, ensuring consistency.
  const effectiveRole = data?.userRole ?? accessContext?.role ?? null;
  const canAccessSettings = effectiveRole === "owner" || effectiveRole === "manager";

  // While both server data and access context are still loading, show a loading state
  // instead of prematurely showing "Access Restricted"
  const isStillLoading = !data && (loading || accessLoading);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={(effectiveRole || "staff") as "owner" | "manager" | "staff"}
          userName={
            (typeof data?.user?.user_metadata?.full_name === "string"
              ? data.user.user_metadata.full_name
              : null) ||
            data?.user?.email?.split("@")[0] ||
            "User"
          }
        />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Venue Settings</h1>
          <p className="text-lg text-foreground mt-2">Manage your venue settings and preferences</p>
        </div>

        {canAccessSettings && data?.user && data?.venue ? (
          <VenueSettingsClient
            user={data.user as User}
            venue={data.venue as unknown as import("./hooks/useVenueSettings").Venue}
            venues={(data.venues || []) as unknown as import("./hooks/useVenueSettings").Venue[]}
            organization={data.organization as Organization | undefined}
            isOwner={data.isOwner}
          />
        ) : isStillLoading || (canAccessSettings && !data?.venue) ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-blue-700">Loading settings...</p>
          </div>
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
