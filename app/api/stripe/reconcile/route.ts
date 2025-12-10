import Stripe from "stripe";
import { NextRequest } from "next/server";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors, success } from "@/lib/api/standard-response";
import { createAdminClient } from "@/lib/supabase";
import { logger, apiLogger } from "@/lib/logger";
import { processSubscriptionEvent, finalizeStripeEvent } from "@/app/api/stripe/webhooks/route";
import {
  processCustomerCheckoutSession,
  finalizeEventStatus,
} from "@/app/api/stripe/webhook/route";

const MAX_BATCH = 20;
const STALE_MINUTES = 5;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withUnifiedAuth(
  async (req: NextRequest) => {
    const supabase = createAdminClient();
    try {
      const rateResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateResult.reset - Date.now()) / 1000));
      }

      const { searchParams } = new URL(req.url);
      const limit = Math.min(Number(searchParams.get("limit") || MAX_BATCH), MAX_BATCH);
      const staleBefore = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();

      // Fetch candidate events that need replay
      const { data: candidates, error: fetchError } = await supabase
        .from("stripe_webhook_events")
        .select("event_id, type, status, attempts, payload, updated_at")
        .in("status", ["failed", "received", "processing"])
        .order("created_at", { ascending: true })
        .limit(limit);

      if (fetchError) {
        logger.error("[STRIPE RECONCILE] Failed to fetch events", { error: fetchError.message });
        return apiErrors.internal("Failed to fetch events");
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

          if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const correlationId = session.metadata?.correlation_id;
            await processCustomerCheckoutSession(session, supabase, correlationId);
            await finalizeEventStatus(supabase, ev.event_id, "succeeded");
          } else {
            await processSubscriptionEvent(event);
            await finalizeStripeEvent(supabase, ev.event_id, "succeeded");
          }

          replayed.push(ev.event_id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const stack = err instanceof Error ? err.stack : undefined;
          apiLogger.error("[STRIPE RECONCILE] Replay failed", {
            eventId: ev.event_id,
            type: ev.type,
            error: message,
          });
          await finalizeStripeEvent(supabase, ev.event_id, "failed", { message, stack });
          failed.push({ eventId: ev.event_id, message });
        }
      }

      return success({
        replayed,
        failed,
      });
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
