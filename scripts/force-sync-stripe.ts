/**
 * Force Sync Subscription from Stripe to Database
 * Run this to manually sync when database and Stripe are out of sync
 */

import { createAdminClient } from "../lib/supabase";
import { stripe } from "../lib/stripe-client";

const ORGANIZATION_ID = "65493772-a3a7-4f08-a396-ff4c86c2c7e1";

async function forceSyncStripe() {
  console.log("🔄 Starting force sync for organization:", ORGANIZATION_ID);

  const supabase = createAdminClient();

  // Get organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, stripe_customer_id, subscription_tier, subscription_status")
    .eq("id", ORGANIZATION_ID)
    .single();

  if (orgError || !org) {
    console.error("❌ Organization not found:", orgError);
    process.exit(1);
  }

  console.log("📊 Current database state:", {
    organizationId: org.id,
    currentTier: org.subscription_tier,
    currentStatus: org.subscription_status,
    stripeCustomerId: org.stripe_customer_id,
  });

  if (!org.stripe_customer_id) {
    console.error("❌ No Stripe customer ID found!");
    process.exit(1);
  }

  // Fetch from Stripe
  console.log("🔍 Fetching subscriptions from Stripe...");
  const subscriptions = await stripe.subscriptions.list({
    customer: org.stripe_customer_id,
    status: "active",
    limit: 10,
  });

  console.log(`📥 Found ${subscriptions.data.length} active subscriptions in Stripe`);

  if (subscriptions.data.length === 0) {
    console.log("⚠️ No active subscriptions in Stripe!");

    // Check for trialing subscriptions
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: org.stripe_customer_id,
      status: "trialing",
      limit: 10,
    });

    if (trialingSubscriptions.data.length > 0) {
      console.log(`📥 Found ${trialingSubscriptions.data.length} trialing subscriptions`);
      subscriptions.data = trialingSubscriptions.data;
    } else {
      console.error("❌ No active or trialing subscriptions found!");
      process.exit(1);
    }
  }

  const subscription = subscriptions.data[0];
  const priceId = subscription.items.data[0]?.price.id;

  console.log("💰 Stripe subscription details:", {
    subscriptionId: subscription.id,
    status: subscription.status,
    priceId: priceId,
  });

  // Map price ID to tier
  const PRICE_TO_TIER: Record<string, string> = {
    [process.env.STRIPE_BASIC_PRICE_ID || ""]: "starter",
    [process.env.STRIPE_STANDARD_PRICE_ID || ""]: "pro",
    [process.env.STRIPE_PREMIUM_PRICE_ID || ""]: "enterprise",
  };

  console.log("🔑 Environment variable check:", {
    STRIPE_BASIC_PRICE_ID: process.env.STRIPE_BASIC_PRICE_ID,
    STRIPE_STANDARD_PRICE_ID: process.env.STRIPE_STANDARD_PRICE_ID,
    STRIPE_PREMIUM_PRICE_ID: process.env.STRIPE_PREMIUM_PRICE_ID,
  });

  console.log("🎯 Price ID matching:", {
    priceId,
    matchesBasic: priceId === process.env.STRIPE_BASIC_PRICE_ID,
    matchesStandard: priceId === process.env.STRIPE_STANDARD_PRICE_ID,
    matchesPremium: priceId === process.env.STRIPE_PREMIUM_PRICE_ID,
  });

  const tierFromStripe = PRICE_TO_TIER[priceId] || "starter";

  console.log("📊 Tier mapping result:", {
    tierFromStripe,
    currentTierInDB: org.subscription_tier,
    needsUpdate: tierFromStripe !== org.subscription_tier,
  });

  // Update database
  if (tierFromStripe !== org.subscription_tier) {
    console.log("✏️ Updating database...");
    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        subscription_tier: tierFromStripe,
        subscription_status: subscription.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ORGANIZATION_ID);

    if (updateError) {
      console.error("❌ Update failed:", updateError);
      process.exit(1);
    }

    console.log("✅ Database updated successfully!");
    console.log("📊 New state:", {
      oldTier: org.subscription_tier,
      newTier: tierFromStripe,
      status: subscription.status,
    });
  } else {
    console.log("ℹ️ Database already in sync - no update needed");
  }

  console.log("\n🎉 Sync complete!");
}

forceSyncStripe().catch((error) => {
  console.error("💥 Script failed:", error);
  process.exit(1);
});
