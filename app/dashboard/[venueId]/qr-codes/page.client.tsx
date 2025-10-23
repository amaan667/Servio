"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCodeClient from "./QRCodeClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { supabaseBrowser } from "@/lib/supabase";

export default function QRCodeClientPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    user_metadata?: { full_name?: string };
    email?: string;
  } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string>("Your Venue");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const supabase = supabaseBrowser();

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user;

        if (!currentUser) {
          console.info("⚠️  [QR CODES CLIENT] No user found, redirecting to sign-in");
          router.push(`/sign-in?redirect=/dashboard/${venueId}/qr-codes`);
          return;
        }

        console.info("🔐 [QR CODES CLIENT] Auth check:", {
          venueId,
          userId: currentUser.id,
          timestamp: new Date().toISOString(),
        });

        setUser(currentUser);

        // Check if user is the venue owner
        const { data: venue } = await supabase
          .from("venues")
          .select("venue_id, venue_name, owner_user_id")
          .eq("venue_id", venueId)
          .eq("owner_user_id", currentUser.id)
          .maybeSingle();

        // Check if user has a staff role for this venue
        const { data: roleData } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", currentUser.id)
          .eq("venue_id", venueId)
          .maybeSingle();

        const isOwner = !!venue;
        const isStaff = !!roleData;

        console.info("✅ [QR CODES CLIENT] Authorization check:", {
          venueId,
          userId: currentUser.id,
          isOwner,
          isStaff,
          role: roleData?.role,
          timestamp: new Date().toISOString(),
        });

        if (!isOwner && !isStaff) {
          setAuthError("You don't have access to this venue");
          setLoading(false);
          return;
        }

        // Get venue name (from owner check or fetch separately for staff)
        if (venue?.venue_name) {
          setVenueName(venue.venue_name as string);
        } else if (isStaff) {
          const { data: staffVenue } = await supabase
            .from("venues")
            .select("venue_name")
            .eq("venue_id", venueId)
            .single();
          if (staffVenue?.venue_name) {
            setVenueName(staffVenue.venue_name);
          }
        }

        const finalRole = isOwner ? "owner" : roleData?.role || "staff";
        setUserRole(finalRole);

        console.info("🚀 [QR CODES CLIENT] Rendering page:", {
          venueId,
          userId: currentUser.id,
          finalRole,
          isOwner,
          isStaff,
          timestamp: new Date().toISOString(),
        });

        setLoading(false);
      } catch (error) {
        console.error("❌ [QR CODES CLIENT] Auth error:", error);
        setAuthError("Failed to verify access");
        setLoading(false);
      }
    }

    checkAuth();
  }, [venueId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">{authError}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!user || !userRole) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={userRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
        />

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
