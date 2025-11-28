import SettingsClientPage from "./page.client";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function SettingsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // STEP 1: Server-side auth check - settings requires owner or manager
  const auth = await requirePageAuth(venueId, {
    requireRole: ["owner", "manager"],
  });

  // STEP 2: Now safe to fetch data using admin client
  const supabase = createAdminClient();

  // Fetch all settings data on server using admin client (bypasses RLS)
  // Auth already verified above, so safe to use admin client
  const [venueResult, userRoleResult, allVenuesResult, firstVenueResult] = await Promise.all([
    supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .eq("owner_user_id", auth.user.id)
      .maybeSingle(),
    supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", auth.user.id)
      .eq("venue_id", venueId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", auth.user.id)
      .order("created_at", { ascending: true }),
    // Fetch first venue with organization_id by owner (same as home page and debug endpoint)
    supabase
      .from("venues")
      .select("organization_id")
      .eq("owner_user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  logger.info("[SETTINGS PAGE] First venue fetch result", {
    userId: auth.user.id,
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

    // AUTOMATIC: Sync tier from Stripe if organization has Stripe customer
    // This ensures tier is always up-to-date, even if webhooks haven't fired yet
    if (orgData?.stripe_customer_id) {
      try {
        const { stripe } = await import("@/lib/stripe-client");
        const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");

        // Get active subscription from Stripe
        const subscriptions = await stripe.subscriptions.list({
          customer: orgData.stripe_customer_id,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          const stripeTier = await getTierFromStripeSubscription(subscription, stripe);

          // Only update if tier differs from database (use Stripe as source of truth)
          if (stripeTier !== orgData.subscription_tier) {
            logger.info("[SETTINGS PAGE] Auto-syncing tier from Stripe", {
              organizationId: orgData.id,
              databaseTier: orgData.subscription_tier,
              stripeTier,
            });

            const { error: updateError } = await supabase
              .from("organizations")
              .update({
                subscription_tier: stripeTier,
                subscription_status: subscription.status,
                updated_at: new Date().toISOString(),
              })
              .eq("id", orgData.id);

            if (!updateError) {
              // Update organization object with new tier
              organization = {
                ...orgData,
                subscription_tier: stripeTier,
                subscription_status: subscription.status,
              };
              logger.info("[SETTINGS PAGE] Tier auto-synced successfully", {
                organizationId: orgData.id,
                newTier: stripeTier,
              });
            } else {
              logger.error("[SETTINGS PAGE] Failed to auto-sync tier", {
                error: updateError,
                organizationId: orgData.id,
              });
            }
          }
        }
      } catch (syncError) {
        // Log but don't fail - webhooks will handle sync eventually
        logger.warn("[SETTINGS PAGE] Auto-sync tier failed (non-critical)", {
          error: syncError instanceof Error ? syncError.message : String(syncError),
          organizationId: orgData.id,
        });
      }
    }
  } else {
    logger.warn("[SETTINGS PAGE] No organization_id found for user", { userId: auth.user.id });
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

  // Venue access already verified by requirePageAuth, so finalVenue should exist
  if (!finalVenue) {
    logger.error("[SETTINGS PAGE] Venue not found after auth verification", {
      userId: auth.user.id,
      venueId,
    });
    // This shouldn't happen, but handle gracefully
    return <SettingsClientPage venueId={venueId} />;
  }

  const initialData = {
    user: {
      id: auth.user.id,
      email: auth.user.email ?? undefined,
      user_metadata: {},
    },
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
    organizationId: organization?.id,
    subscriptionTier: organization?.subscription_tier,
    hasStripeCustomer: !!organization?.stripe_customer_id,
    userRole: initialData.userRole,
    venueCount: allVenues.length,
  });

  return <SettingsClientPage venueId={venueId} initialData={initialData} />;
}
