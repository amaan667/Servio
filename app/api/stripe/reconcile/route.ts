import Stripe from "stripe";
import { NextRequest } from "next/server";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors, success } from "@/lib/api/standard-response";
import { createAdminClient } from "@/lib/supabase";
import { logger, apiLogger } from "@/lib/logger";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";
import { processSubscriptionEvent, finalizeStripeEvent } from "@/app/api/stripe/webhooks/route";
import {
  processCustomerCheckoutSession,
  finalizeEventStatus,
} from "@/app/api/stripe/webhook/route";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const DEFAULT_WINDOW_HOURS = 24;
const STALE_MINUTES = 5;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function runStripeReconcile({
  supabase,
  limit,
  windowHours,
  staleMinutes,
  requestId,
}: {
  supabase: SupabaseAdmin;
  limit?: number;
  windowHours?: number;
  staleMinutes?: number;
  requestId?: string;
}) {
  const batchLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const windowDurationHours = Math.min(Math.max(windowHours ?? DEFAULT_WINDOW_HOURS, 1), 72);
  const staleWindowMinutes = Math.max(staleMinutes ?? STALE_MINUTES, 1);

  const windowStart = new Date(Date.now() - windowDurationHours * 60 * 60 * 1000).toISOString();
  const staleBefore = new Date(Date.now() - staleWindowMinutes * 60_000).toISOString();

  const { data: candidates, error: fetchError } = await supabase
    .from("stripe_webhook_events")
    .select("event_id, type, status, attempts, payload, updated_at, created_at")
    .in("status", ["failed", "received", "processing"])
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true })
    .limit(batchLimit);

  if (fetchError) {
    logger.error("[STRIPE RECONCILE] Failed to fetch events", {
      error: fetchError.message,
      requestId,
    });
    throw new Error("Failed to fetch events");
  }

  const replayed: string[] = [];
  const failed: Array<{ eventId: string; message: string }> = [];

  for (const ev of candidates || []) {
    const isStale =
      ev.status === "processing" &&
      new Date(ev.updated_at).getTime() < new Date(staleBefore).getTime();
    if (ev.status === "processing" && !isStale) {
      continue; // skip active processing
    }

    // Lock the event for processing
    const attempts = (ev.attempts || 0) + 1;
    const { error: lockError } = await supabase
      .from("stripe_webhook_events")
      .update({
        status: "processing",
        attempts,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", ev.event_id)
      .neq("status", "succeeded");

    if (lockError) {
      failed.push({ eventId: ev.event_id, message: lockError.message });
      continue;
    }

    try {
      const event = ev.payload as unknown as Stripe.Event;
      if (!event || !event.type) {
        throw new Error("Invalid stored payload");
      }

      const metadata =
        typeof (event as { data?: { object?: { metadata?: Record<string, unknown> } } }).data
          ?.object?.metadata === "object"
          ? ((event.data!.object as { metadata?: Record<string, unknown> }).metadata as
              | Record<string, unknown>
              | undefined)
          : undefined;

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const correlationId = session.metadata?.correlation_id ?? requestId;
        await processCustomerCheckoutSession(session, supabase, correlationId);
        await finalizeEventStatus(supabase, ev.event_id, "succeeded");
      } else {
        await processSubscriptionEvent(event);
        await finalizeStripeEvent(supabase, ev.event_id, "succeeded");
      }

      replayed.push(ev.event_id);
      apiLogger.info("[STRIPE RECONCILE] Replay succeeded", {
        eventId: ev.event_id,
        type: ev.type,
        venueId: metadata?.venue_id ?? metadata?.venueId,
        orderId: metadata?.order_id ?? metadata?.orderId,
        requestId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const stack = err instanceof Error ? err.stack : undefined;
      await finalizeStripeEvent(supabase, ev.event_id, "failed", { message, stack });
      failed.push({ eventId: ev.event_id, message });
      apiLogger.error("[STRIPE RECONCILE] Replay failed", {
        eventId: ev.event_id,
        type: ev.type,
        error: message,
        requestId,
      });
    }
  }

  return {
    replayed,
    failed,
    scanned: candidates?.length ?? 0,
    windowStart,
    limit: batchLimit,
    windowHours: windowDurationHours,
  };
}

export const POST = withUnifiedAuth(
  async (req: NextRequest) => {
    const supabase = createAdminClient();
    try {
      const rateResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateResult.reset - Date.now()) / 1000));
      }

      const requestId = getCorrelationIdFromRequest(req);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("[STRIPE RECONCILE] Unexpected error", { error: message });
      return apiErrors.internal(message);
    }
  },
  {
    requireOwner: true,
  }
);
