/**
 * Script to fix the database constraint to allow new tier names
 * This updates the organizations_subscription_tier_check constraint
 * to allow "starter", "pro", "enterprise" instead of old tier names
 * 
 * Run with: npx tsx scripts/fix-tier-constraint.ts
 */

// Load environment variables FIRST
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function fixTierConstraint() {
  console.log("🔧 Fixing database constraint for subscription tiers...\n");

  // Drop the old constraint
  const dropConstraint = `
    ALTER TABLE organizations 
    DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;
  `;

  // Create new constraint with correct tier names
  const createConstraint = `
    ALTER TABLE organizations 
    ADD CONSTRAINT organizations_subscription_tier_check 
    CHECK (subscription_tier IN ('starter', 'pro', 'enterprise'));
  `;

  try {
    console.log("1. Dropping old constraint...");
    const { error: dropError } = await supabase.rpc("exec_sql", {
      sql: dropConstraint,
    });

    if (dropError) {
      // Try direct SQL execution
      const { error: directDropError } = await supabase
        .from("organizations")
        .select("id")
        .limit(0); // This won't work, but let's try a different approach

      // Use raw SQL via PostgREST isn't possible, so we'll need to use a different method
      console.log("⚠️  Cannot drop constraint via Supabase client. Please run this SQL manually:");
      console.log("\n" + dropConstraint);
      console.log("\n" + createConstraint);
      console.log("\nOr use the Supabase SQL Editor to run these commands.");
      return;
    }

    console.log("2. Creating new constraint...");
    const { error: createError } = await supabase.rpc("exec_sql", {
      sql: createConstraint,
    });

    if (createError) {
      console.error("❌ Error creating constraint:", createError);
      console.log("\n⚠️  Please run this SQL manually in Supabase SQL Editor:");
      console.log("\n" + createConstraint);
      return;
    }

    console.log("✅ Constraint updated successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    console.log("\n⚠️  Please run this SQL manually in Supabase SQL Editor:");
    console.log("\n" + dropConstraint);
    console.log("\n" + createConstraint);
  }
}

fixTierConstraint().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});

