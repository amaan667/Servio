"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import InventoryClient from "./InventoryClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";

interface InventoryClientPageProps {
  venueId: string;
  tier: string;
  role: string;
}

export default function InventoryClientPage({
  venueId,
  tier: _tier,
  role,
}: InventoryClientPageProps) {
  const [venueName, setVenueName] = useState<string>("Your Venue");

  useEffect(() => {
    // Fetch venue name only
    const fetchVenueName = async () => {
      const supabase = supabaseBrowser();
      const { data: venue } = await supabase
        .from("venues")
        .select("venue_name")
        .eq("venue_id", venueId)
        .single();
      if (venue?.venue_name) {
        setVenueName(venue.venue_name);
      }
    };

    fetchVenueName();
  }, [venueId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation venueId={venueId} userRole={role as UserRole} userName="User" />

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
