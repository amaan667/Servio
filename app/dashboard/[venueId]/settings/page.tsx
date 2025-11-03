import SettingsClientPage from "./page.client";
import { logger } from "@/lib/logger";
import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase";

export default async function SettingsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;


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


  // Fetch all settings data on server using admin client (bypasses RLS)
  const [venueResult, userRoleResult, allVenuesResult, firstVenueResult] = await Promise.all([
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
    // FIXED: Fetch first venue with organization_id by owner (same as home page and debug endpoint)
    supabase
      .from("venues")
      .select("organization_id")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  logger.info("[SETTINGS PAGE] First venue fetch result", {
    userId: user.id,
    hasData: !!firstVenueResult.data,
    organizationId: firstVenueResult.data?.organization_id,
    error: firstVenueResult.error?.message,
  });

  // Fetch organization if we have an organization_id
  let organization: {
    id: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    subscription_status?: string;
    trial_ends_at?: string;
  } | null = null;

  if (firstVenueResult.data?.organization_id) {
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
      .eq("id", firstVenueResult.data.organization_id)
      .single();

    logger.info("[SETTINGS PAGE] Organization fetch result", {
      organizationId: firstVenueResult.data.organization_id,
      hasOrgData: !!orgData,
      orgData,
      error: orgError?.message,
    });

    organization = orgData;
  } else {
    logger.warn("[SETTINGS PAGE] No organization_id found for user", { userId: user.id });
  }

  const venue = venueResult.data;
  const userRole = userRoleResult.data;
  const allVenues = allVenuesResult.data || [];

  logger.info("[SETTINGS PAGE] ⭐ Final data state", {
    hasOrganization: !!organization,
    tier: organization?.subscription_tier,
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
