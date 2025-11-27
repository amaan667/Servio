/**
 * Script to sync organization tiers from Stripe
 * This will update any organizations with old tier names (basic, standard, premium)
 * to the correct tier names (starter, pro, enterprise) based on their Stripe subscriptions
 * 
 * Run with: npx tsx scripts/sync-tiers-from-stripe.ts
 */

// Load environment variables FIRST
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getTierFromStripeSubscription } from "@/lib/stripe-tier-helper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey || !stripeKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "✓" : "✗");
  console.error("   STRIPE_SECRET_KEY:", stripeKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-12-18.acacia",
});

async function syncTiersFromStripe() {
  console.log("🔄 Syncing organization tiers from Stripe...\n");

  // Get all organizations
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching organizations:", error);
    process.exit(1);
  }

  if (!organizations || organizations.length === 0) {
    console.log("No organizations found in database.");
    return;
  }

  console.log(`Found ${organizations.length} organization(s)\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const org of organizations) {
    const currentTier = org.subscription_tier;
    const stripeSubscriptionId = org.stripe_subscription_id;
    const stripeCustomerId = org.stripe_customer_id;

    // Check if tier needs updating (old tier names or missing)
    const needsUpdate = !currentTier || 
      !["starter", "pro", "enterprise"].includes(currentTier.toLowerCase());

    if (!needsUpdate) {
      console.log(`✓ ${org.id.substring(0, 38)}: Already has correct tier "${currentTier}"`);
      skipped++;
      continue;
    }

    // Try to get tier from Stripe subscription
    let newTier: string | null = null;

    if (stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        newTier = await getTierFromStripeSubscription(subscription, stripe);
        console.log(`📊 ${org.id.substring(0, 38)}: Found tier "${newTier}" from Stripe subscription`);
      } catch (error) {
        console.error(`❌ ${org.id.substring(0, 38)}: Error fetching subscription:`, 
          error instanceof Error ? error.message : String(error));
        errors++;
        continue;
      }
    } else if (stripeCustomerId) {
      // Try to find subscription by customer
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "all",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          newTier = await getTierFromStripeSubscription(subscription, stripe);
          console.log(`📊 ${org.id.substring(0, 38)}: Found tier "${newTier}" from customer subscription`);
          
          // Also update stripe_subscription_id if missing
          if (!stripeSubscriptionId) {
            const { error: updateSubError } = await supabase
              .from("organizations")
              .update({ stripe_subscription_id: subscription.id })
              .eq("id", org.id);
            
            if (updateSubError) {
              console.error(`⚠️  ${org.id.substring(0, 38)}: Failed to update subscription_id:`, updateSubError);
            }
          }
        } else {
          console.log(`⚠️  ${org.id.substring(0, 38)}: No Stripe subscription found, defaulting to "starter"`);
          newTier = "starter";
        }
      } catch (error) {
        console.error(`❌ ${org.id.substring(0, 38)}: Error fetching customer subscriptions:`, 
          error instanceof Error ? error.message : String(error));
        errors++;
        continue;
      }
    } else {
      // No Stripe customer or subscription - default to starter
      console.log(`⚠️  ${org.id.substring(0, 38)}: No Stripe customer, defaulting to "starter"`);
      newTier = "starter";
    }

    // Update organization tier
    if (newTier) {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ 
          subscription_tier: newTier,
          updated_at: new Date().toISOString(),
        })
        .eq("id", org.id);

      if (updateError) {
        console.error(`❌ ${org.id.substring(0, 38)}: Failed to update tier:`, updateError);
        errors++;
      } else {
        console.log(`✅ ${org.id.substring(0, 38)}: Updated "${currentTier || "none"}" → "${newTier}"`);
        updated++;
      }
    }
  }

  console.log("\n" + "─".repeat(60));
  console.log("📊 Summary:");
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log("\n✅ Sync complete!");
}

syncTiersFromStripe().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});

