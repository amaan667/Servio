import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      const body = await req.json();
      const { type, title, description, email, userAgent, timestamp } = body;

      // STEP 4: Validate inputs
      if (!description || !type) {
        return apiErrors.badRequest("Missing required fields");
      }

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = createAdminClient();

      // Store feedback in database
      const { error } = await supabase.from("feedback").insert({
        type,
        title: title || `${type} submission`,
        description,
        email,

      if (error) {
        
        // Don't fail if database insert fails - log it
      }

      // Log to console for immediate visibility during pilot
      

      // STEP 7: Return success response
      return success({});
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      

      if (errorMessage.includes("Unauthorized")) {
        return apiErrors.unauthorized(errorMessage);
      }
      if (errorMessage.includes("Forbidden")) {
        return apiErrors.forbidden(errorMessage);
      }

      return apiErrors.internal(
        isDevelopment() ? errorMessage : "Request processing failed",
        isDevelopment() && errorStack ? { stack: errorStack } : undefined
      );
    }
  },
  {
    // System route - no venue required

  }
);
