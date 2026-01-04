"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import QRCodeClient from "./QRCodeClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useAccessContext } from "@/lib/access/useAccessContext";

export default function QRCodeClientPage({ venueId }: { venueId: string }) {
  const { user, isLoading: authLoading } = useAuthRedirect();
  const { role: userRole } = useAccessContext(venueId);
  const [venueName, setVenueName] = useState<string>("My Venue");

  // Fetch venue name (not part of access context)
  useEffect(() => {
    if (!user?.id) return;
    const supabase = supabaseBrowser();
    void supabase
      .from("venues")
      .select("venue_name")
      .eq("venue_id", venueId)
      .single()
      .then(({ data }) => {
        if (data?.venue_name) {
          setVenueName(data.venue_name);
        }
      });
  }, [user?.id, venueId]);

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
        {/* Always render navigation if we have a venueId, show loading state while fetching role */}
        {venueId && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole || "staff"}
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
