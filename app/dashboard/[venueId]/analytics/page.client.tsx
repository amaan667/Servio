"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/auth/AuthProvider";
import { supabaseBrowser } from "@/lib/supabase";
// import AnalyticsClient from "./AnalyticsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { UserRole } from "@/lib/permissions";

export default function AnalyticsClientPage({ venueId }: { venueId: string }) {
  const { user } = useAuth();

  // Cache user role to prevent flicker
  const getCachedRole = () => {
    if (typeof window === "undefined" || !user?.id) return null;
    return sessionStorage.getItem(`user_role_${user.id}_${venueId}`);
  };

  const [userRole, setUserRole] = useState<string | null>(getCachedRole());

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) return;

      const supabase = supabaseBrowser();

      // Check cached role first
      const cachedRole = sessionStorage.getItem(`user_role_${user.id}`);
      if (cachedRole) {
        setUserRole(cachedRole);
        return;
      }

      // Check if owner
      const { data: ownerVenue } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("owner_user_id", user.id)
        .eq("venue_id", venueId)
        .single();

      if (ownerVenue) {
        setUserRole("owner");
        sessionStorage.setItem(`user_role_${user.id}_${venueId}`, "owner");
      } else {
        // Check staff role
        const { data: staffRole } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("venue_id", venueId)
          .single();

        if (staffRole) {
          setUserRole(staffRole.role);
          sessionStorage.setItem(`user_role_${user.id}_${venueId}`, staffRole.role);
        }
      }
    };

    fetchUserRole();
  }, [user, venueId]);

  // Render immediately - no auth checks, no loading spinners
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {user && userRole && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole as UserRole}
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-lg text-foreground mt-2">
            View detailed insights and performance metrics for your venue
          </p>
        </div>

        <div className="text-center py-12">
          <p className="text-muted-foreground">Analytics dashboard coming soon</p>
          <p className="text-sm text-muted-foreground mt-2">
            Use the server-side analytics page at /dashboard/{venueId}/analytics
          </p>
        </div>
      </div>
    </div>
  );
}
