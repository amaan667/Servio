"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/auth/AuthProvider";
import { supabaseBrowser } from "@/lib/supabase";
import InventoryClient from "./InventoryClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";
import { isValidUserRole } from "@/lib/utils/userRole";
import { useAuthRedirect } from "../hooks/useAuthRedirect";

export default function InventoryClientPage({ venueId }: { venueId: string }) {
  const { user, isLoading: authLoading } = useAuthRedirect();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [venueName, setVenueName] = useState<string>("Your Venue");

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
        // Fetch venue name
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_name")
          .eq("venue_id", venueId)
          .single();
        if (venue?.venue_name) {
          setVenueName(venue.venue_name);
        }
      } else {
        // Check staff role
        const { data: staffRole } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("venue_id", venueId)
          .single();

        if (staffRole) {
          const role = staffRole.role as UserRole;
          setUserRole(role);
          sessionStorage.setItem(`user_role_${user.id}`, role);
        }

        // Fetch venue name
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_name")
          .eq("venue_id", venueId)
          .single();
        if (venue?.venue_name) {
          setVenueName(venue.venue_name);
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
            Inventory Management
          </h1>
          <p className="text-lg text-foreground mt-2">Track and manage your inventory</p>
        </div>

        <InventoryClient venueId={venueId} venueName={venueName} />
      </div>
    </div>
  );
}
