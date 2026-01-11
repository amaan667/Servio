import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const createTableSessionSchema = z.object({
  table_id: z.string().uuid("Invalid table ID"),
  customer_name: z.string().min(1, "Customer name is required").optional(),
  party_size: z.number().int().positive("Party size must be positive").optional(),
});

// POST /api/table-sessions - Create a new table session
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Validate input
    const body = await validateBody(createTableSessionSchema, await req.json());

    // STEP 3: Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 4: Business logic - Create table session
    const supabase = await createClient();

    // Verify table belongs to venue
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("venue_id")
      .eq("id", body.table_id)
      .eq("venue_id", venueId)
      .single();

    if (tableError || !table) {

      return apiErrors.notFound("Table not found");
    }

    const { data: session, error: createError } = await supabase
      .from("table_sessions")
      .insert({
        table_id: body.table_id,
        venue_id: venueId,
        customer_name: body.customer_name || null,
        party_size: body.party_size || null,
        status: "ORDERING",
        opened_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !session) {

      return apiErrors.database(
        "Failed to create table session",
        isDevelopment() ? createError?.message : undefined
      );
    }

    // STEP 5: Return success response
    return success({ session });
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});
