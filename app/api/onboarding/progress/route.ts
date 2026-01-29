// Server-side onboarding progress tracking
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

const updateProgressSchema = z.object({
  current_step: z.number().int().min(1).optional(),
  completed_steps: z.array(z.number().int()).optional(),
  data: z.record(z.unknown()).optional(),
});

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Business logic
      const supabase = await createClient();
      const { data: progress, error } = await supabase
        .from("onboarding_progress")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        return apiErrors.database(
          "Failed to fetch progress",
          isDevelopment() ? error.message : undefined
        );
      }

      // STEP 4: Return success response
      return success({
        progress: progress || {
          user_id: user.id,
          current_step: 1,
          completed_steps: [],
          data: {},
        },
      });
    } catch (error) {
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

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Validate input
      const body = await validateBody(updateProgressSchema, await req.json());

      // STEP 4: Business logic
      const supabase = await createClient();
      const { error } = await supabase.from("onboarding_progress").upsert({
        user_id: user.id,
        current_step: body.current_step || 1,
        completed_steps: body.completed_steps || [],
        data: body.data || {},
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return apiErrors.database(
          "Failed to save progress",
          isDevelopment() ? error.message : undefined
        );
      }

      // STEP 5: Return success response
      return success({ success: true });
    } catch (error) {
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
