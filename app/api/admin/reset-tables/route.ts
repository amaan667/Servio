import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody, validateQuery } from "@/lib/api/validation-schemas";

const resetTablesSchema = z.object({
  venueId: z.string().uuid().optional(),
  venue_id: z.string().uuid().optional(),
  resetType: z.enum(["all", "venue"]).default("all"),
});

const getResetLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(resetTablesSchema, await req.json());
      const finalVenueId = context.venueId || body.venueId || body.venue_id;

      // STEP 3: Business logic
      const supabase = await createClient();
      let result;

      if (body.resetType === "venue" && finalVenueId) {
        // Delete specific venue tables
        const { data, error } = await supabase.rpc("delete_venue_tables", {
          p_venue_id: finalVenueId,
        });

        if (error) {
          logger.error("[RESET TABLES POST] Venue deletion error:", {
            error: error.message,
            venueId: finalVenueId,
            userId: context.user.id,
          });
          return apiErrors.database(
            "Failed to delete venue tables",
            isDevelopment() ? error.message : undefined
          );
        }

        result = data;
      } else {
        // Delete all tables
        const { data, error } = await supabase.rpc("manual_table_deletion", {
          p_venue_id: null,
        });

        if (error) {
          logger.error("[RESET TABLES POST] Manual deletion error:", {
            error: error.message,
            userId: context.user.id,
          });
          return apiErrors.database(
            "Failed to delete tables",
            isDevelopment() ? error.message : undefined
          );
        }

        result = data;
      }

      logger.info("[RESET TABLES POST] Tables reset successfully", {
        resetType: body.resetType,
        venueId: finalVenueId,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({ data: result });
    } catch (error) {
      logger.error("[RESET TABLES POST] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from body or query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        if (!venueId) {
          const body = await req.json().catch(() => ({}));
          venueId =
            (body as { venueId?: string; venue_id?: string })?.venueId ||
            (body as { venueId?: string; venue_id?: string })?.venue_id ||
            null;
        }
        return venueId;
      } catch {
        return null;
      }
    },
  }
);

// GET endpoint to check reset logs
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate query parameters
      const { searchParams } = new URL(req.url);
      const query = validateQuery(getResetLogsQuerySchema, {
        limit: searchParams.get("limit") || "10",
      });

      // STEP 3: Business logic
      const supabase = await createClient();

      // Get recent deletion logs
      const { data, error } = await supabase
        .from("table_deletion_logs")
        .select("*")
        .order("deletion_timestamp", { ascending: false })
        .limit(query.limit);

      if (error) {
        logger.error("[RESET TABLES GET] Reset logs error:", {
          error: error.message,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch reset logs",
          isDevelopment() ? error.message : undefined
        );
      }

      // STEP 4: Return success response
      return success({ data: data || [] });
    } catch (error) {
      logger.error("[RESET TABLES GET] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
