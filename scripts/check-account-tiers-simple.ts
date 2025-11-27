/**
 * Script to check all accounts and their assigned tiers
 * Run with: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/check-account-tiers-simple.ts
 */

// Load environment variables FIRST
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Direct Supabase client creation to avoid module-level execution
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "✓" : "✗");
  console.error("\nPlease set these in .env.local or .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function checkAccountTiers() {
  console.log("📊 Checking all accounts and their tiers...\n");

  // Get all organizations
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, owner_user_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error fetching organizations:", error);
    process.exit(1);
  }

  if (!organizations || organizations.length === 0) {
    console.log("No organizations found in database.");
    return;
  }

  console.log(`Found ${organizations.length} organization(s):\n`);

  // Group by tier
  const tierCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  organizations.forEach((org) => {
    const tier = org.subscription_tier || "none";
    const status = org.subscription_status || "none";
    
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Display summary
  console.log("📈 Summary by Tier:");
  console.log("─".repeat(50));
  Object.entries(tierCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tier, count]) => {
      const icon = tier === "starter" ? "🟢" : tier === "pro" ? "🔵" : tier === "enterprise" ? "🟣" : "⚪";
      console.log(`  ${icon} ${tier.padEnd(12)}: ${count}`);
    });

  console.log("\n📊 Summary by Status:");
  console.log("─".repeat(50));
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status.padEnd(12)}: ${count}`);
    });

  // Display detailed list
  console.log("\n📋 Detailed Account List:");
  console.log("─".repeat(100));
  console.log(
    "ID".padEnd(40) +
    "Tier".padEnd(12) +
    "Status".padEnd(12) +
    "Stripe Customer".padEnd(20) +
    "Created"
  );
  console.log("─".repeat(100));

  organizations.forEach((org) => {
    const tier = org.subscription_tier || "none";
    const status = org.subscription_status || "none";
    const stripeCustomer = org.stripe_customer_id ? "✓" : "✗";
    const createdDate = org.created_at
      ? new Date(org.created_at).toLocaleDateString()
      : "N/A";

    console.log(
      org.id.substring(0, 38).padEnd(40) +
      tier.padEnd(12) +
      status.padEnd(12) +
      stripeCustomer.padEnd(20) +
      createdDate
    );
  });

  // Check for invalid tiers
  const invalidTiers = organizations.filter(
    (org) =>
      org.subscription_tier &&
      !["starter", "pro", "enterprise"].includes(org.subscription_tier.toLowerCase())
  );

  if (invalidTiers.length > 0) {
    console.log("\n⚠️  WARNING: Found organizations with invalid tiers:");
    invalidTiers.forEach((org) => {
      console.log(
        `  - ${org.id.substring(0, 38)}: "${org.subscription_tier}" (should be starter, pro, or enterprise)`
      );
    });
  } else {
    console.log("\n✅ All tiers are valid (starter, pro, or enterprise)");
  }

  console.log("\n✅ Check complete!");
}

checkAccountTiers().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});

