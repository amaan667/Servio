"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/auth/AuthProvider";
import { supabaseBrowser } from "@/lib/supabase";
import KDSClient from "./KDSClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";
import { isValidUserRole } from "@/lib/utils/userRole";
import { useAuthRedirect } from "../hooks/useAuthRedirect";

export default function KDSClientPage({
  venueId,
  initialTickets,
  initialStations,
}: {
  venueId: string;
  initialTickets?: unknown[] | null;
  initialStations?: unknown[] | null;
}) {
  const { user, isLoading: authLoading } = useAuthRedirect();
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) return;

      const supabase = supabaseBrowser();

      // Check cached role first
      const cachedRole = sessionStorage.getItem(`user_role_${user.id}`);
      if (cachedRole && isValidUserRole(cachedRole)) {
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
        sessionStorage.setItem(`user_role_${user.id}`, "owner");
      } else {
        // Check staff role
        const { data: staffRole } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("venue_id", venueId)
          .single();

        if (staffRole && isValidUserRole(staffRole.role)) {
          setUserRole(staffRole.role);
          sessionStorage.setItem(`user_role_${user.id}`, staffRole.role);
        }
      }
    };

    fetchUserRole();
  }, [user, venueId]);

  // Show loading while checking auth
  if (authLoading) {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {user && userRole && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole}
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Kitchen Display System
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage kitchen prep stations and ticket flow
          </p>
        </div>

        <KDSClient
          venueId={venueId}
          initialTickets={initialTickets || undefined}
          initialStations={initialStations || undefined}
        />
      </div>
    </div>
  );
}
