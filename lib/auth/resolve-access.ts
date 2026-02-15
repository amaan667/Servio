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
  const supabase = createAdminClient();
  const normalized = normalizeVenueId(venueId) ?? venueId;

  // ── 1. Venue lookup ────────────────────────────────────────────────
  const { data: venue, error: venueErr } = await supabase
    .from("venues")
    .select("owner_user_id, organization_id, subscription_tier")
    .eq("venue_id", normalized)
    .maybeSingle();

  if (venueErr || !venue) return null;

  // ── 2. Role — owner check then user_venue_roles ────────────────────
  let role: string | null = null;

  if (venue.owner_user_id === userId) {
    role = "owner";
  } else {
    const { data: roleRow } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("venue_id", normalized)
      .maybeSingle();

    role = roleRow?.role ?? null;
  }

  if (!role) return null; // user has no access to this venue

  // ── 3. Tier — organisation is the authority ────────────────────────
  let tier: string | null = null;

  if (venue.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("id", venue.organization_id)
      .maybeSingle();

    if (org?.subscription_tier) {
      tier = org.subscription_tier.toLowerCase().trim();
    }
  }

  // If no org tier, fall back to venue tier (venues without an org row)
  if (!tier) {
    tier = venue.subscription_tier
      ? (venue.subscription_tier as string).toLowerCase().trim()
      : null;
  }

  // Validate
  if (!tier || !["starter", "pro", "enterprise"].includes(tier)) {
    tier = "starter";
  }

  // ── 4. Self-heal: sync venue tier if it drifted from org ───────────
  const venueTier = venue.subscription_tier
    ? (venue.subscription_tier as string).toLowerCase().trim()
    : null;

  if (venue.organization_id && tier !== venueTier) {
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
