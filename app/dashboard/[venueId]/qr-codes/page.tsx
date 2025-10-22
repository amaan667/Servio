import QRCodeClient from "./QRCodeClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { createServerSupabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function QRCodePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  console.info("📍 [QR CODES PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  const supabase = await createServerSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  console.info("🔐 [QR CODES PAGE] Auth check:", {
    venueId,
    hasSession: !!session,
    hasUser: !!user,
    userId: user?.id || "none",
    timestamp: new Date().toISOString(),
  });

  if (!user) {
    console.info("⚠️  [QR CODES PAGE] No user found, redirecting to sign-in");
    redirect(`/sign-in?redirect=/dashboard/${venueId}/qr-codes`);
  }

  // Check if user is the venue owner
  const { data: venue } = await supabase
    .from("venues")
    .select("venue_id, venue_name, owner_user_id")
    .eq("venue_id", venueId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  // Check if user has a staff role for this venue
  const { data: userRole } = await supabase
    .from("user_venue_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .maybeSingle();

  const isOwner = !!venue;
  const isStaff = !!userRole;

  console.info("✅ [QR CODES PAGE] Authorization check:", {
    venueId,
    userId: user.id,
    isOwner,
    isStaff,
    role: userRole?.role,
    timestamp: new Date().toISOString(),
  });

  // If user is not owner or staff, show error
  if (!isOwner && !isStaff) {
    console.info("❌ [QR CODES PAGE] Access denied - user not authorized for venue");
    return <div>You don&apos;t have access to this venue</div>;
  }

  // Get venue details for staff
  let finalVenue = venue;
  if (!venue && isStaff) {
    const { data: staffVenue } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .single();

    if (!staffVenue) {
      return <div>Venue not found</div>;
    }
    finalVenue = staffVenue;
  }

  const finalUserRole = userRole?.role || (isOwner ? "owner" : "staff");

  console.info("🚀 [QR CODES PAGE] Rendering page:", {
    venueId,
    userId: user.id,
    finalUserRole,
    venueName: finalVenue?.venue_name,
    timestamp: new Date().toISOString(),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={finalUserRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
        />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">QR Code Generator</h1>
          <p className="text-lg text-foreground mt-2">
            Generate and manage QR codes for your tables and counters
          </p>
        </div>

        <QRCodeClient venueId={venueId} venueName={finalVenue?.venue_name || "Your Venue"} />
      </div>
    </div>
  );
}
