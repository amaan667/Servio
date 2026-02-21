/**
 * resolveVenueAccess — THE single source of truth for role + tier.
 *
 * Reads directly from the database via the admin client (bypasses RLS).
 * Every server-side path that needs role or tier for a (userId, venueId)
 * pair MUST call this function.  No defaults, no guesses — if the data
 * cannot be read from the DB the function returns null.
 *
 * Tier resolution order (first non-null wins):
 *   1. organizations.subscription_tier  (authoritative — Stripe webhooks)
 *   2. venues.subscription_tier          (fallback for venues without an org)
 *
 * If the venue tier is stale (differs from the org), a fire-and-forget
 * UPDATE syncs it so future reads are consistent.
 */

import { createAdminClient } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";
import { resolveTierFromDb } from "@/lib/utils/tier";
import { logger } from "@/lib/monitoring/structured-logger";

export interface ResolvedAccess {
  userId: string;
  venueId: string;
  role: string;
  tier: string;
  organizationId: string | null;
}

export async function resolveVenueAccess(
  userId: string,
  venueId: string
): Promise<ResolvedAccess | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("resolveVenueAccess: SUPABASE_SERVICE_ROLE_KEY missing");
    return null;
  }
  const supabase = createAdminClient();
  const normalized = normalizeVenueId(venueId) ?? venueId;

  // ── 1. Venue lookup ────────────────────────────────────────────────
  // Note: subscription_tier may not exist on venues; tier comes from organizations
  const { data: venue, error: venueErr } = await supabase
    .from("venues")
    .select("owner_user_id, organization_id")
    .eq("venue_id", normalized)
    .maybeSingle();

  if (venueErr || !venue) {
    logger.warn("resolveVenueAccess: venue not found", {
      venueId: normalized,
      userId,
      error: venueErr?.message,
    });
    return null;
  }

  // ── 2. Role — owner check then user_venue_roles ────────────────────
  let role: string | null = null;

  if (venue.owner_user_id === userId) {
    role = "owner";
  } else {
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("venue_id", normalized)
      .maybeSingle();

    role = roleRow?.role ?? null;

    if (!role) {
      logger.warn("resolveVenueAccess: no role found", {
        venueId: normalized,
        userId,
        ownerUserId: venue.owner_user_id,
        roleQueryError: roleErr?.message,
      });
    }
  }

  if (!role) return null;

  // ── 3. Tier — organisation is the authority, venue is fallback ───────
  // Use DB values only. Never overwrite pro/enterprise with starter.
  const orgTier = venue.organization_id
    ? (
        await supabase
          .from("organizations")
          .select("subscription_tier")
          .eq("id", venue.organization_id)
          .maybeSingle()
      ).data?.subscription_tier
    : null;
  const tier = resolveTierFromDb(orgTier ?? null);

  // ── 4. Self-heal: sync venue tier if column exists and drifted from org ───────────
  const venueWithTier = venue as { subscription_tier?: string | null };
  const venueTierNormalized = venueWithTier.subscription_tier
    ? (venueWithTier.subscription_tier as string).toLowerCase().trim()
    : null;

  if (venue.organization_id && venueTierNormalized != null && tier !== venueTierNormalized) {
    // Fire-and-forget — never block the caller
    supabase
      .from("venues")
      .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
      .eq("venue_id", normalized)
      .then(() => {
        /* intentionally empty */
      });
  }

  return {
    userId,
    venueId: normalized,
    role,
    tier,
    organizationId: venue.organization_id ?? null,
  };
}
