import MenuManagementClient from "./MenuManagementClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { createServerSupabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function MenuManagementPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  console.info("📍 [MENU MANAGEMENT PAGE] Page accessed:", {
    venueId,
    timestamp: new Date().toISOString(),
  });

  const supabase = await createServerSupabase();

  // Safely get user without throwing errors
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  console.info("🔐 [MENU MANAGEMENT PAGE] Auth check:", {
    venueId,
    hasSession: !!session,
    hasUser: !!user,
    userId: user?.id || "none",
    timestamp: new Date().toISOString(),
  });

  if (!user) {
    console.info("⚠️  [MENU MANAGEMENT PAGE] No user found, redirecting to sign-in");
    redirect(`/sign-in?redirect=/dashboard/${venueId}/menu-management`);
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

  console.info("✅ [MENU MANAGEMENT PAGE] Authorization check:", {
    venueId,
    userId: user.id,
    isOwner,
    isStaff,
    role: userRole?.role,
    timestamp: new Date().toISOString(),
  });

  // If user is not owner or staff, show error
  if (!isOwner && !isStaff) {
    console.info("❌ [MENU MANAGEMENT PAGE] Access denied - user not authorized for venue");
    return <div>You don&apos;t have access to this venue</div>;
  }

  // Get venue details for staff
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
  const canEditMenu = finalUserRole === "owner" || finalUserRole === "manager";

  console.info("🚀 [MENU MANAGEMENT PAGE] Rendering page:", {
    venueId,
    userId: user.id,
    finalUserRole,
    canEditMenu,
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Menu Management</h1>
          <p className="text-lg text-foreground mt-2">
            {canEditMenu ? "Advanced menu management and organization" : "View menu items"}
          </p>
          {!canEditMenu && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Read-only mode:</strong> You can view menu items but cannot make changes.
                Only Owners and Managers can edit the menu.
              </p>
            </div>
          )}
        </div>

        <MenuManagementClient venueId={venueId} canEdit={canEditMenu} />
      </div>
    </div>
  );
}
