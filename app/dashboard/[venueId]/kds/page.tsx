import KDSClient from "./KDSClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { createServerSupabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function KDSPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  console.info("📍 [KDS PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  const supabase = await createServerSupabase();

  // Safely get user without throwing errors
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  console.info("🔐 [KDS PAGE] Auth check:", {
    venueId,
    hasSession: !!session,
    hasUser: !!user,
    userId: user?.id || "none",
    timestamp: new Date().toISOString(),
  });

  if (!user) {
    console.info("⚠️  [KDS PAGE] No user found, redirecting to sign-in");
    redirect(`/sign-in?redirect=/dashboard/${venueId}/kds`);
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

  console.info("✅ [KDS PAGE] Authorization check:", {
    venueId,
    userId: user.id,
    isOwner,
    isStaff,
    role: userRole?.role,
    timestamp: new Date().toISOString(),
  });

  // If user is not owner or staff, show error
  if (!isOwner && !isStaff) {
    console.info("❌ [KDS PAGE] Access denied - user not authorized for venue");
    return <div>You don&apos;t have access to this venue</div>;
  }

  // Get venue details if user is staff
  if (!venue && isStaff) {
    const { data: staffVenue } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .single();

    if (!staffVenue) {
      return <div>Venue not found</div>;
    }
  }

  const finalUserRole = userRole?.role || (isOwner ? "owner" : "staff");
  const canViewKDS =
    finalUserRole === "owner" || finalUserRole === "manager" || finalUserRole === "kitchen";

  console.info("🚀 [KDS PAGE] Rendering page:", {
    venueId,
    userId: user.id,
    finalUserRole,
    canViewKDS,
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Kitchen Display System
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage kitchen prep stations and ticket flow
          </p>
        </div>

        {canViewKDS ? (
          <KDSClient venueId={venueId} />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Access Restricted</h3>
            <p className="text-yellow-700">
              You don&apos;t have permission to view the Kitchen Display System. This feature is
              available for Owner, Manager, and Kitchen roles only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
