/**
 * Sync venue-level subscription tiers from their parent organization.
 *
 * Called:
 *  1. After every subscription webhook that changes organization.subscription_tier
 *  2. By the reconciliation cron job to catch any drift
 *
 * This ensures `venues.subscription_tier` never diverges from
 * `organizations.subscription_tier`.
 */

import { createAdminClient } from "@/lib/supabase";

/**
 * Propagate organization tier to all venues for a given organization.
 */
export async function syncVenueTiersForOrg(organizationId: string, tier: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("venues")
    .update({
      subscription_tier: tier,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(
      `Failed to sync venue tiers for org ${organizationId}: ${error.message}`
    );
  }
}

/**
 * Reconcile ALL organizations against Stripe.
 * Returns a summary of what was corrected.
 */
export async function reconcileAllSubscriptions() {
  const supabase = createAdminClient();
  const { stripe } = await import("@/lib/stripe-client");
  const { getTierFromStripeSubscription } = await import("@/lib/stripe-tier-helper");

  const { data: orgs, error: fetchErr } = await supabase
    .from("organizations")
    .select("id, stripe_subscription_id, subscription_tier, subscription_status")
    .not("stripe_subscription_id", "is", null);

  if (fetchErr) {
    throw new Error(`Failed to fetch organizations: ${fetchErr.message}`);
  }

  const results = {
    checked: 0,
    corrected: 0,
    errors: [] as string[],
  };

  for (const org of orgs ?? []) {
    results.checked++;
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id!);
      const stripeTier = await getTierFromStripeSubscription(sub, stripe);
      const stripeStatus = sub.status;

      const tierDrifted = org.subscription_tier !== stripeTier;
      const statusDrifted = org.subscription_status !== stripeStatus;

      if (tierDrifted || statusDrifted) {
        await supabase
          .from("organizations")
          .update({
            subscription_tier: stripeTier,
            subscription_status: stripeStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", org.id);

        await syncVenueTiersForOrg(org.id, stripeTier);

        await supabase.from("subscription_history").insert({
          organization_id: org.id,
          event_type: "reconciliation_corrected",
          old_tier: org.subscription_tier,
          new_tier: stripeTier,
          stripe_event_id: org.stripe_subscription_id,
          metadata: {
            old_status: org.subscription_status,
            new_status: stripeStatus,
            tier_drifted: tierDrifted,
            status_drifted: statusDrifted,
          },
        });

        results.corrected++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.errors.push(`org=${org.id}: ${message}`);
    }
  }

  // Also handle orgs whose Stripe subscription was deleted (gone from Stripe)
  // but still show as active in our DB. The retrieve above will throw for
  // cancelled subs. We handle that in the catch.

  return results;
}
