"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/auth/AuthProvider";
import { supabaseBrowser } from "@/lib/supabase";
import QRCodeClient from "./QRCodeClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";

export default function QRCodeClientPage({ venueId }: { venueId: string }) {
  const { user } = useAuth();
  const [venueName, setVenueName] = useState<string>("My Venue");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchVenueData = async () => {
      if (!user?.id) return;

      const supabase = supabaseBrowser();

      // Fetch venue name
      const { data: venueData } = await supabase
        .from("venues")
        .select("venue_name")
        .eq("venue_id", venueId)
        .single();

      if (venueData) {
        setVenueName(venueData.venue_name);
      }

      // Fetch user role
      const cachedRole = sessionStorage.getItem(`user_role_${user.id}`);
      if (cachedRole) {
        setUserRole(cachedRole);
      } else {
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

          if (staffRole) {
            setUserRole(staffRole.role);
            sessionStorage.setItem(`user_role_${user.id}`, staffRole.role);
          }
        }
      }
    };

    fetchVenueData();
  }, [user, venueId]);

  // Debug: Log venueId to ensure it's present
  console.info("[QR Codes Page] venueId:", venueId, "user:", user?.id, "userRole:", userRole);

  // Render immediately - no auth checks, no loading spinners
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {/* Always render navigation if we have a venueId, show loading state while fetching role */}
        {venueId && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={(userRole || "staff") as unknown}
            userName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">QR Code Generator</h1>
          <p className="text-lg text-foreground mt-2">
            Generate and manage QR codes for your tables and counters
          </p>
        </div>

        <QRCodeClient venueId={venueId} venueName={venueName} />
      </div>
    </div>
  );
}
