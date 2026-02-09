import { NextRequest } from "next/server";
import { apiErrors, success } from "@/lib/api/standard-response";
import { env } from "@/lib/env";
import { alertCritical, alertWarning, alertResolved } from "@/lib/alerting/slack";
import { checkRedisHealth } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health Monitor Cron
 *
 * Checks critical dependencies and sends alerts on failure:
 *   1. Supabase / database connectivity
 *   2. Redis connectivity
 *   3. Stripe API reachability
 *
 * Auth: Bearer CRON_SECRET
 * Schedule: every 5 minutes via Railway cron or external scheduler
 */
export async function POST(req: NextRequest) {
  const expectedSecret = env("CRON_SECRET") || "default-cron-secret";
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return apiErrors.unauthorized("Unauthorized");
  }

  const checks: Record<string, { healthy: boolean; latency?: number; error?: string }> = {};

  // 1. Supabase / Database check
  try {
    const start = Date.now();
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();
    const { error } = await supabase.from("venues").select("venue_id").limit(1);
    const latency = Date.now() - start;

    if (error) {
      checks.database = { healthy: false, latency, error: error.message };
    } else {
      checks.database = { healthy: true, latency };
    }
  } catch (err) {
    checks.database = {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Redis check
  try {
    checks.redis = await checkRedisHealth();
  } catch (err) {
    checks.redis = {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 3. Stripe check
  try {
    const start = Date.now();
    const stripeKey = env("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      checks.stripe = { healthy: false, error: "STRIPE_SECRET_KEY not configured" };
    } else {
      const response = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${stripeKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const latency = Date.now() - start;
      checks.stripe = { healthy: response.ok, latency };
      if (!response.ok) {
        checks.stripe.error = `HTTP ${response.status}`;
      }
    }
  } catch (err) {
    checks.stripe = {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Send alerts for unhealthy services
  const unhealthy = Object.entries(checks).filter(([, v]) => !v.healthy);
  const allHealthy = unhealthy.length === 0;

  if (unhealthy.length > 0) {
    const details: Record<string, string | number | boolean> = {};
    for (const [name, check] of unhealthy) {
      details[name] = check.error || "unhealthy";
    }

    const severity = unhealthy.some(([name]) => name === "database") ? "critical" : "warning";
    const alertFn = severity === "critical" ? alertCritical : alertWarning;

    await alertFn(
      `Health Check Failed: ${unhealthy.map(([n]) => n).join(", ")}`,
      `${unhealthy.length} service(s) are unhealthy in ${process.env.NODE_ENV || "development"}`,
      details
    );
  } else {
    // Send resolved alert (only meaningful after a previous failure)
    await alertResolved(
      "All Health Checks Passing",
      "Database, Redis, and Stripe are all healthy",
      {
        database_latency_ms: checks.database?.latency || 0,
        redis_latency_ms: checks.redis?.latency || 0,
        stripe_latency_ms: checks.stripe?.latency || 0,
      }
    );
  }

  return success({
    healthy: allHealthy,
    checks,
    timestamp: new Date().toISOString(),
  });
}
