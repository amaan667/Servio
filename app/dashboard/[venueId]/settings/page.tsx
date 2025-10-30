import SettingsClientPage from "./page.client";
import { logger } from "@/lib/logger";
import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  logger.info("[SETTINGS PAGE] 🔧 Settings page accessed", { venueId });

  // Fetch ALL data on server-side using ADMIN client (no auth required!)
  const supabase = createAdminClient();

  // Get user from read-only auth client
  const authClient = await createServerSupabaseReadOnly();
  const {
    data: { session },
    error: sessionError,
  } = await authClient.auth.getSession();

  const user = session?.user;

  // If no user, pass undefined to client - it will handle gracefully
  if (!user) {
    logger.warn("[SETTINGS PAGE] No user session - rendering with empty data", {
      hasError: !!sessionError,
    });
    return <SettingsClientPage venueId={venueId} />;
  }

  logger.info("[SETTINGS PAGE] User authenticated on server", { userId: user.id });

  // Fetch all settings data on server using admin client (bypasses RLS)
  const [venueResult, userRoleResult, allVenuesResult, orgResult] = await Promise.all([
    supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("venue_id", venueId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("venues")
      .select("organization_id")
      .eq("venue_id", venueId)
      .single()
      .then(async (result) => {
        logger.info("[SETTINGS PAGE] Venue organization_id lookup", {
          venueId,
          hasData: !!result.data,
          organizationId: result.data?.organization_id,
          error: result.error?.message,
        });

        if (result.data?.organization_id) {
          const orgResult = await supabase
            .from("organizations")
            .select("id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
            .eq("id", result.data.organization_id)
            .single();

          logger.info("[SETTINGS PAGE] Organization fetch result", {
            organizationId: result.data.organization_id,
            hasOrgData: !!orgResult.data,
            orgData: orgResult.data,
            error: orgResult.error?.message,
          });

          return orgResult;
        }
        logger.warn("[SETTINGS PAGE] No organization_id on venue", { venueId });
        return { data: null };
      }),
  ]);

  const venue = venueResult.data;
  const userRole = userRoleResult.data;
  const allVenues = allVenuesResult.data || [];
  const organization = "error" in orgResult ? null : orgResult.data;

  // Log organization fetch result
  logger.info("[SETTINGS PAGE] Organization fetch result", {
    hasOrganization: !!organization,
    orgData: organization,
    hasError: "error" in orgResult,
    orgResultType: typeof orgResult,
  });

  const isOwner = !!venue;
  const isManager = userRole?.role === "manager";

  // If manager but not owner, fetch venue separately
  let finalVenue = venue;
  if (!venue && isManager) {
    const { data: managerVenue } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .single();
    finalVenue = managerVenue;
  }

  // If still no venue, pass undefined to client
  if (!finalVenue) {
    logger.warn("[SETTINGS PAGE] User has no access to venue - rendering anyway", {
      userId: user.id,
      venueId,
    });
    return <SettingsClientPage venueId={venueId} />;
  }

  const initialData = {
    user,
    venue: finalVenue,
    venues: allVenues,
    organization,
    isOwner,
    isManager,
    userRole: userRole?.role || (isOwner ? "owner" : "staff"),
  };

  logger.info("[SETTINGS PAGE] Data fetched on server", {
    hasVenue: !!finalVenue,
    hasOrganization: !!organization,
    organizationId: (organization as any)?.id,
    subscriptionTier: (organization as any)?.subscription_tier,
    hasStripeCustomer: !!(organization as any)?.stripe_customer_id,
    userRole: initialData.userRole,
    venueCount: allVenues.length,
  });

  return <SettingsClientPage venueId={venueId} initialData={initialData} />;
}
