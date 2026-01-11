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

      // Database connectivity

      // Entitlements system

      // Order state machine

    };

    // Test database connectivity
    try {
      const supabase = await createServerSupabase();
      const { data, error } = await supabase.from("venues").select("count").limit(1);
      checks.database = !error;
    } catch (error) {
      
    }

    // Test entitlements RPC
    try {
      const supabase = await createServerSupabase();
      // Test with a non-existent venue to check if RPC exists and is accessible
      const { error } = await supabase.rpc("get_venue_entitlements", {

      // We expect an error (venue not found), but if RPC doesn't exist, we'd get a different error
      checks.entitlementsRpc = !!error && (error.message?.includes("forbidden") || error.message?.includes("not found"));
    } catch (error) {
      
    }

    // Test downgrade validation function
    try {
      const supabase = await createServerSupabase();
      const { data, error } = await supabase.rpc("validate_tier_downgrade", {

      checks.downgradeValidation = !error && typeof data === "boolean";
    } catch (error) {
      
    }

    // Check if order state machine is importable
    try {
      await import("@/lib/orders/state-machine");
      checks.orderStateMachine = true;
    } catch (error) {
      
    }

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

      checks,

        allCriticalPass,

      },
    }, {

  } catch (error) {
    
    return NextResponse.json({

    }, { status: 500 });
  }
}