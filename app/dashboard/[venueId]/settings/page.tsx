import SettingsClientPage from "./page.client";

import { createAdminClient } from "@/lib/supabase";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { normalizeVenueId } from "@/lib/utils/venueId";

export default async function SettingsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

  // STEP 1: Get auth from middleware headers (backed by get_access_context RPC).
  // Do NOT filter by requireRole here — the RPC already resolved the real role
  // from the database. We check it below after an admin-client fallback so that
  // a transient middleware/RPC issue cannot lock the owner out of settings.
  const auth = await requirePageAuth(venueId).catch(() => null);

  const supabase = createAdminClient();

  // STEP 2: Resolve user identity. Prefer middleware auth; fall back to a direct
  // Supabase server call when middleware headers are missing.
  let userId = auth?.user?.id ?? null;
  let userEmail = auth?.user?.email ?? undefined;
  let userRole: string = auth?.role ?? "staff";
  let userTier: string = auth?.tier ?? "starter";

  if (!userId) {
    try {
      const { createServerSupabaseReadOnly } = await import("@/lib/supabase");
      const serverSupabase = await createServerSupabaseReadOnly();
      const {
        data: { user: serverUser },
      } = await serverSupabase.auth.getUser();
      if (serverUser) {
        userId = serverUser.id;
        userEmail = serverUser.email ?? undefined;
      }
    } catch {
      // Fall through — userId stays null
    }
  }

  // STEP 3: If we have a user but the role/tier from middleware is unreliable
  // (e.g. default "staff" or "starter"), verify against the database directly.
  // This is the admin-client fallback — it reads the ACTUAL data from the DB
  // and eliminates any mismatch between the RPC result and reality.
  if (userId) {
    // Always verify role and tier from the database to avoid stale middleware headers
    const { data: venueData } = await supabase
      .from("venues")
      .select("owner_user_id, subscription_tier, organization_id")
      .eq("venue_id", normalizedVenueId)
      .maybeSingle();

    if (venueData) {
      // Resolve role from database
      if (venueData.owner_user_id === userId) {
        userRole = "owner";
      } else {
        const { data: roleData } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("venue_id", normalizedVenueId)
          .maybeSingle();
        userRole = roleData?.role ?? userRole;
      }

      // Resolve tier: organization is the authoritative source; venue is fallback.
      // This fixes the mismatch where venues.subscription_tier can be stale while
      // organizations.subscription_tier has the correct value (e.g. "enterprise").
      let resolvedTier = venueData.subscription_tier?.toLowerCase().trim() || "starter";
      if (venueData.organization_id) {
        const { data: orgTierData } = await supabase
          .from("organizations")
          .select("subscription_tier")
          .eq("id", venueData.organization_id)
          .maybeSingle();
        if (orgTierData?.subscription_tier) {
          const orgTier = orgTierData.subscription_tier.toLowerCase().trim();
          // Trust the organization tier — it is updated by Stripe webhooks
          resolvedTier = orgTier;

          // If the venue tier is out of sync, fix it now (self-healing)
          if (orgTier !== (venueData.subscription_tier?.toLowerCase().trim() || "starter")) {
            supabase
              .from("venues")
              .update({
                subscription_tier: orgTier,
                updated_at: new Date().toISOString(),
              })
              .eq("venue_id", normalizedVenueId)
              .then(() => {
                // Fire-and-forget sync — don't block the page render
              });
          }
        }
      }
      userTier = resolvedTier;
    }
  }

  // Access check — only owner and manager can access settings
  const isOwner = userRole === "owner";
  const isManager = userRole === "manager";

  // Publish auth info for client-side __PLATFORM_AUTH__
  const authInfo = {
    hasAuth: !!auth,
    userId,
    email: userEmail,
    tier: userTier,
    role: userRole,
    venueId: normalizedVenueId,
    timestamp: new Date().toISOString(),
    page: "Settings",
  };

  // If user is not authenticated at all, render without initialData (client will handle)
  if (!userId) {
    return <SettingsClientPage venueId={venueId} />;
  }

  // STEP 4: Fetch venue + related data for the settings UI
  const [venueResult, allVenuesResult] = await Promise.all([
    supabase.from("venues").select("*").eq("venue_id", normalizedVenueId).maybeSingle(),
    supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  // Fetch organization for display (billing info shown in settings)
  let organization: {
    id: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    subscription_status?: string;
    trial_ends_at?: string;
  } | null = null;

  const finalVenue = venueResult.data;
  if (finalVenue?.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
      .eq("id", finalVenue.organization_id)
      .single();
    organization = orgData || null;
  }

  const allVenues = allVenuesResult.data || [];

  // If venue doesn't exist, let the client handle it
  if (!finalVenue) {
    return <SettingsClientPage venueId={venueId} />;
  }

  const initialData = {
    user: {
      id: userId,
      email: userEmail,
      user_metadata: {},
    },
    venue: finalVenue,
    venues: allVenues,
    organization,
    isOwner,
    isManager,
    userRole,
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <SettingsClientPage venueId={venueId} initialData={initialData} />
    </>
  );
}
