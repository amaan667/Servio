/**
 * Script to update organization subscription tier
 * Usage: npx ts-node scripts/update-subscription-tier.ts <email> <tier>
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function updateSubscriptionTier(email: string, tier: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);


  // Find user by email
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find((u) => u.email === email);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    return;
  }


  // Find organization for this user
  const { data: venues } = await supabase
    .from("venues")
    .select("organization_id")
    .eq("owner_user_id", user.id)
    .limit(1);

  if (!venues || venues.length === 0) {
    console.error(`❌ No venues found for user ${user.id}`);
    return;
  }

  const organizationId = venues[0].organization_id;

  // Get current organization data
  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  if (!org) {
    console.error(`❌ Organization not found: ${organizationId}`);
    return;
  }

  console.log(`📊 Current subscription:`, {
    tier: org.subscription_tier,
    status: org.subscription_status,
    stripeCustomerId: org.stripe_customer_id,
  });

  // Update subscription tier
  const { error } = await supabase
    .from("organizations")
    .update({
      subscription_tier: tier,
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    console.error(`❌ Failed to update:`, error);
    return;
  }

  console.log(`✅ Successfully updated subscription tier to: ${tier}`);

  // Verify
  const { data: updated } = await supabase
    .from("organizations")
    .select("subscription_tier, subscription_status")
    .eq("id", organizationId)
    .single();

}

const email = process.argv[2] || "amaantanveer667@gmail.com";
const tier = process.argv[3] || "premium";

updateSubscriptionTier(email, tier)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error:", err);
    process.exit(1);
  });
