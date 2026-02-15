"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthProvider";
import VenueSettingsClient from "./VenueSettingsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { User } from "@supabase/supabase-js";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { apiClient } from "@/lib/api-client";

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

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(initialData || null);
  const [clientRole, setClientRole] = useState<string | null>(null);
  const [clientLoading, setClientLoading] = useState(!initialData);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When the server didn't provide initialData (e.g. middleware + all
  // server-side fallbacks failed), fetch via the canonical API endpoint.
  // This uses the same resolveVenueAccess path as getAuthContext().
  useEffect(() => {
    if (initialData) return;
    if (!mounted || !session?.user) return;

    const fetchData = async () => {
      try {
        // 1. Get role/tier from the canonical endpoint (same DB path as server)
        const ctxRes = await apiClient.get(
          `/api/auth/access-context?venueId=${encodeURIComponent(venueId)}`
        );
        const ctx = await ctxRes.json();
        const role = ctx.role ?? null;
        setClientRole(role);

        if (!role) {
          setClientLoading(false);
          return;
        }

        // 2. Fetch venue data for the settings UI
        const currentUser = session.user;
        const supabase = supabaseBrowser();

        const [venueResult, allVenuesResult] = await Promise.all([
          supabase.from("venues").select("*").eq("venue_id", venueId).maybeSingle(),
          supabase
            .from("venues")
            .select("*")
            .eq("owner_user_id", currentUser.id)
            .order("created_at", { ascending: true }),
        ]);

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

        setData({
          user: currentUser,
          venue,
          venues: allVenuesResult.data || [],
          organization,
          isOwner: role === "owner",
          isManager: role === "manager",
          userRole: role,
        });
      } catch {
        // Silently handled
      } finally {
        setClientLoading(false);
      }
    };

    fetchData();
  }, [venueId, initialData, session, mounted]);

  if (!mounted || !user) {
    return null;
  }

  // Role comes from either:
  //   a) initialData.userRole — server-side, resolved from getAuthContext (DB)
  //   b) clientRole           — client-side, resolved from /api/auth/access-context (same DB)
  // Both use resolveVenueAccess.  No fabricated values.
  const effectiveRole = data?.userRole ?? clientRole ?? null;
  const canAccessSettings = effectiveRole === "owner" || effectiveRole === "manager";
  const isStillLoading = !data && clientLoading;

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
        ) : isStillLoading ? (
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
