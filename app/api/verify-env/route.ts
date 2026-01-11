/**
 * Environment Verification Endpoint
 * Checks if required environment variables are set and services are accessible
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(_request: NextRequest) {
  try {
    const checks = {
      // Environment variables
      SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      STRIPE_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,

      // Database connectivity
      database: false,

      // Entitlements system
      entitlementsRpc: false,
      downgradeValidation: false,

      // Order state machine
      orderStateMachine: false,
    };

    // Test database connectivity
    try {
      const supabase = await createServerSupabase();
      const { data, error } = await supabase.from("venues").select("count").limit(1);
      checks.database = !error;
    } catch (error) { /* Error handled silently */ }

    // Test entitlements RPC
    try {
      const supabase = await createServerSupabase();
      // Test with a non-existent venue to check if RPC exists and is accessible
      const { error } = await supabase.rpc("get_venue_entitlements", {
        p_venue_id: "test-venue-id",
      });
      // We expect an error (venue not found), but if RPC doesn't exist, we'd get a different error
      checks.entitlementsRpc = !!error && (error.message?.includes("forbidden") || error.message?.includes("not found"));
    } catch (error) { /* Error handled silently */ }

    // Test downgrade validation function
    try {
      const supabase = await createServerSupabase();
      const { data, error } = await supabase.rpc("validate_tier_downgrade", {
        p_organization_id: "00000000-0000-0000-0000-000000000000",
        p_new_tier: "starter",
      });
      checks.downgradeValidation = !error && typeof data === "boolean";
    } catch (error) { /* Error handled silently */ }

    // Check if order state machine is importable
    try {
      await import("@/lib/orders/state-machine");
      checks.orderStateMachine = true;
    } catch (error) { /* Error handled silently */ }

    // Determine overall health
    const criticalChecks = [
      checks.SUPABASE_URL,
      checks.SUPABASE_ANON_KEY,
      checks.SUPABASE_SERVICE_ROLE_KEY,
      checks.STRIPE_PUBLIC_KEY,
      checks.STRIPE_SECRET_KEY,
      checks.database,
      checks.entitlementsRpc,
    ];

    const allCriticalPass = criticalChecks.every(Boolean);
    const allChecksPass = Object.values(checks).every(Boolean);

    return NextResponse.json({
      status: allCriticalPass ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        total: Object.keys(checks).length,
        passing: Object.values(checks).filter(Boolean).length,
        criticalPassing: criticalChecks.filter(Boolean).length,
        allCriticalPass,
        allPass: allChecksPass,
      },
    }, {
      status: allCriticalPass ? 200 : 503,
    });

  } catch (error) {

    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}