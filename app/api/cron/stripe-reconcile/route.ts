import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors, success } from "@/lib/api/standard-response";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";
import { runStripeReconcile } from "@/app/api/stripe/reconcile/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron-safe endpoint to replay Stripe webhook events in bounded batches.
 * Auth: Bearer CRON_SECRET
 */
export async function POST(req: NextRequest) {
  const rateResult = await rateLimit(req, RATE_LIMITS.GENERAL);
  if (!rateResult.success) {
    return apiErrors.rateLimit(Math.ceil((rateResult.reset - Date.now()) / 1000));
  }

  const expectedSecret = env("CRON_SECRET") || "default-cron-secret";
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    logger.warn("[CRON STRIPE RECONCILE] Unauthorized cron request", {
      hasHeader: !!authHeader,
    });
    return apiErrors.unauthorized("Unauthorized");
  }

  const requestId = getCorrelationIdFromRequest(req);
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const windowParam = searchParams.get("windowHours");

  const result = await runStripeReconcile({
    supabase,
    limit: limitParam ? Number(limitParam) : undefined,
    windowHours: windowParam ? Number(windowParam) : undefined,
    requestId,
  });

  return success(result);
}
