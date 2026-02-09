import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors, success } from "@/lib/api/standard-response";
import { env } from "@/lib/env";

import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";
import { runStripeReconcile } from "@/app/api/stripe/reconcile/route";
import { reconcileAllSubscriptions } from "@/lib/stripe/sync-venue-tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron-safe endpoint for Stripe reconciliation.
 * Runs TWO passes:
 *   1. Replay failed/stale webhook events (existing behaviour)
 *   2. Compare every organization's tier against Stripe's actual subscription
 *      state and correct any drift (new behaviour)
 *
 * Auth: Bearer CRON_SECRET
 * Schedule: daily via Railway cron or external scheduler
 */
export async function POST(req: NextRequest) {
  const rateResult = await rateLimit(req, RATE_LIMITS.GENERAL);
  if (!rateResult.success) {
    return apiErrors.rateLimit(Math.ceil((rateResult.reset - Date.now()) / 1000));
  }

  const expectedSecret = env("CRON_SECRET") || "default-cron-secret";
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return apiErrors.unauthorized("Unauthorized");
  }

  const requestId = getCorrelationIdFromRequest(req);
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const windowParam = searchParams.get("windowHours");

  // Pass 1: Replay failed/stale webhook events
  const replayResult = await runStripeReconcile({
    supabase,
    limit: limitParam ? Number(limitParam) : undefined,
    windowHours: windowParam ? Number(windowParam) : undefined,
    requestId,
  });

  // Pass 2: Compare Stripe subscription state against DB and correct drift
  let driftResult: { checked: number; corrected: number; errors: string[] } = {
    checked: 0,
    corrected: 0,
    errors: [],
  };
  try {
    driftResult = await reconcileAllSubscriptions();
  } catch (err) {
    driftResult.errors.push(
      `reconciliation_failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return success({
    replay: replayResult,
    drift: driftResult,
  });
}
