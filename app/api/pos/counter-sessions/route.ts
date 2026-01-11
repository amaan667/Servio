import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
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
      const supabase = await createServerSupabase();

      // Get counter status using the function
      const { data: counterStatus, error } = await supabase.rpc("get_counter_status", {

      if (error) {
        
        return apiErrors.database(
          "Failed to fetch counter status",
          isDevelopment() ? error.message : undefined
        );
      }

      // STEP 4: Return success response
      return success({ counters: counterStatus || [] });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from query params

        const { searchParams } = new URL(req.url);
        return searchParams.get("venue_id") || searchParams.get("venueId");
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
      const { action, counter_number, customer_name } = body;

      if (!action || !["start", "end"].includes(action)) {
        return apiErrors.badRequest("Action must be 'start' or 'end'");
      }

      if (action === "start" && (!counter_number || !customer_name)) {
        return apiErrors.badRequest(
          "counter_number and customer_name are required for start action"
        );
      }

      // STEP 4: Business logic
      const supabase = await createServerSupabase();

      if (action === "start") {
        // Start counter session
        const { data: session, error } = await supabase
          .from("counter_sessions")
          .insert({

          .select()
          .single();

        if (error || !session) {
          
          return apiErrors.database(
            "Failed to start counter session",
            isDevelopment() ? error?.message : undefined
          );
        }

        

        return success({ session });
      } else {
        // End counter session
        const { data: session, error } = await supabase
          .from("counter_sessions")
          .update({ status: "CLOSED", closed_at: new Date().toISOString() })
          .eq("venue_id", venueId)
          .eq("status", "ACTIVE")
          .select()
          .single();

        if (error || !session) {
          
          return apiErrors.database(
            "Failed to end counter session",
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
