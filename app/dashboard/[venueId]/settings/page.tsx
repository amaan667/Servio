import SettingsClientPage from "./page.client";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function SettingsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // STEP 1: Server-side auth check - settings requires owner or manager
  const auth = await requirePageAuth(venueId, {
    requireRole: ["owner", "manager"],
  }).catch(() => null);

  // STEP 2: Now safe to fetch data using admin client
  const supabase = createAdminClient();

  // Fetch all settings data on server using admin client (bypasses RLS)
  // Auth already verified above, so safe to use admin client
  // Use same unified approach as other pages - get tier from RPC via auth context
  const [venueResult, userRoleResult, allVenuesResult, firstVenueResult] = await Promise.all([
    supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .eq("owner_user_id", auth?.user?.id ?? "")
      .maybeSingle(),
    supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", auth?.user?.id ?? "")
      .eq("venue_id", venueId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", auth?.user?.id ?? "")
      .order("created_at", { ascending: true }),
    // Fetch first venue with organization_id by owner
    supabase
      .from("venues")
      .select("organization_id")
      .eq("owner_user_id", auth?.user?.id ?? "")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // Fetch organization for display (billing info, etc.) - but tier comes from RPC
  let organization: {
    id: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    subscription_status?: string;
    trial_ends_at?: string;
  } | null = null;

  if (firstVenueResult.data?.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
      .eq("id", firstVenueResult.data.organization_id)
      .single();

    organization = orgData || null;
  }

  // Tier comes from auth context (RPC) - same as all other pages
  // Database is source of truth, webhooks keep it in sync with Stripe

  const venue = venueResult.data;
  const userRole = userRoleResult.data;
  const allVenues = allVenuesResult.data || [];


  logger.info("[SETTINGS PAGE] ⭐ Final data state", {
    hasOrganization: !!organization,
    tierFromRPC: auth?.tier,
    tierFromOrg: organization?.subscription_tier,
    orgId: organization?.id,
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

  // Venue access already verified by requirePageAuth, so finalVenue should exist
  if (!finalVenue) {
    logger.warn("[SETTINGS PAGE] Venue not found after auth verification - checking user_venue_roles", {
      userId: auth?.user?.id,
      venueId,
    });

    // Check if user has a role for this venue (venue might exist in roles but not venues table)
    const { data: userRole } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", auth?.user?.id ?? "")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (userRole && (userRole.role === "owner" || userRole.role === "manager")) {
      logger.info("[SETTINGS PAGE] User has role but venue missing - creating fallback venue", {
        userId: auth?.user?.id,
        venueId,
        role: userRole.role,
      });

      // First get/create organization
      let userOrg = organization;

      // Create a fallback venue record
      const { data: fallbackVenue, error: createError } = await supabase
        .from("venues")
        .insert({
          venue_id: venueId,
          venue_name: `${auth?.user?.email?.split('@')[0] || 'User'}'s Venue`,
          business_type: 'Restaurant',
          owner_user_id: auth?.user?.id ?? "",
          organization_id: userOrg?.id || null,
          is_active: true,
          timezone: 'Europe/London',
          currency: 'GBP',
          daily_reset_time: '06:00:00'
        })
        .select()
        .single();

      if (createError) {
        logger.error("[SETTINGS PAGE] Failed to create fallback venue", {
          error: createError,
          userId: auth?.user?.id,
          venueId,
        });
      } else {
        logger.info("[SETTINGS PAGE] Created fallback venue successfully", {
          venueId,
          venueName: fallbackVenue.venue_name,
          organizationId: fallbackVenue.organization_id,
        });
        finalVenue = fallbackVenue;
      }
    }

    // If we still don't have a venue, show error
    if (!finalVenue) {
      logger.error("[SETTINGS PAGE] Venue creation failed or user lacks access", {
        userId: auth?.user?.id,
        venueId,
        hasRole: !!userRole,
      });
      return <SettingsClientPage venueId={venueId} />;
    }
  }

  const initialData = {
    user: {
      id: auth?.user?.id ?? "",
      email: auth?.user?.email ?? undefined,
      user_metadata: {},
    },
    venue: finalVenue,
    venues: allVenues,
    organization,
    isOwner,
    isManager,
    userRole: userRole?.role || (isOwner ? "owner" : "staff"),
  };


  return <SettingsClientPage venueId={venueId} initialData={initialData} />;
}
