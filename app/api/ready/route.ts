import { createClient } from "@/lib/supabase";
import { redisCache } from "@/lib/cache/redis";
import { success, apiErrors } from "@/lib/api/standard-response";
import { stripe } from "@/lib/stripe-client";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { status: string; responseTime?: number; error?: string }> = {};
  let overallStatus = "ready";

  // Check Supabase connectivity
  try {
    const supabaseStart = Date.now();
    const supabase = await createClient();
    const { error } = await supabase.from("organizations").select("id").limit(1);
    const supabaseTime = Date.now() - supabaseStart;

    if (error) {
      checks.supabase = { status: "error", responseTime: supabaseTime, error: error.message };
      overallStatus = "not_ready";
    } else {
      checks.supabase = { status: "ok", responseTime: supabaseTime };
    }
  } catch (error) {
    checks.supabase = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    overallStatus = "not_ready";
  }

  // Check Redis connectivity
  try {
    const redisStart = Date.now();
    // Try to get a key to verify Redis is working
    await redisCache.exists("health-check");
    const redisTime = Date.now() - redisStart;
    checks.redis = { status: "ok", responseTime: redisTime };
  } catch (error) {
    checks.redis = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    overallStatus = "not_ready";
  }

  // CRITICAL: Check Stripe API connectivity
  // This ensures payment processing is available before reporting "ready"
  try {
    const stripeStart = Date.now();
    // Lightweight API call to verify Stripe connectivity
    await stripe.paymentIntents.list({ limit: 1 });
    const stripeTime = Date.now() - stripeStart;
    checks.stripe = { status: "ok", responseTime: stripeTime };
  } catch (error) {
    checks.stripe = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    overallStatus = "not_ready";
  }

  if (overallStatus === "ready") {
    return success({
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  return apiErrors.serviceUnavailable("Service health checks failed");
}
