import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Business logic
      const supabase = await createClient();

      // Get table status using the function
      const { data: tableStatus, error } = await supabase.rpc("get_table_status", {
        p_venue_id: venueId,
      });

      if (error) {
        return apiErrors.database(
          "Failed to fetch table status",
          isDevelopment() ? error.message : undefined
        );
      }

      // STEP 4: Return success response
      return success({ tables: tableStatus || [] });
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from request (query params)
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        return searchParams.get("venue_id");
      } catch {
        return null;
      }
    },
  }
);

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse and validate input
      const body = await req.json();
      const { action, table_id, customer_name } = body;

      if (!action || !["start", "end"].includes(action)) {
        return apiErrors.badRequest("Action must be 'start' or 'end'");
      }

      if (action === "start" && (!table_id || !customer_name)) {
        return apiErrors.badRequest("table_id and customer_name are required for start action");
      }

      // STEP 4: Business logic
      const supabase = await createClient();

      if (action === "start") {
        // Start table session
        const { data: session, error } = await supabase
          .from("table_sessions")
          .insert({
            venue_id: venueId,
            table_id: table_id,
            customer_name: customer_name,
            status: "ACTIVE",
          })
          .select()
          .single();

        if (error || !session) {
          return apiErrors.database(
            "Failed to start table session",
            isDevelopment() ? error?.message : undefined
          );
        }

        return success({ session });
      } else {
        // End table session
        const { data: session, error } = await supabase
          .from("table_sessions")
          .update({ status: "CLOSED", closed_at: new Date().toISOString() })
          .eq("venue_id", venueId)
          .eq("status", "ACTIVE")
          .select()
          .single();

        if (error || !session) {
          return apiErrors.database(
            "Failed to end table session",
            isDevelopment() ? error?.message : undefined
          );
        }

        return success({ session });
      }
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (
          (body as { venue_id?: string; venueId?: string })?.venue_id ||
          (body as { venue_id?: string; venueId?: string })?.venueId ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);
