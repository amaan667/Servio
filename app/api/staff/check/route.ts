import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Business logic
      const admin = createAdminClient();
      
      // Check if staff table exists
      try {
        const { error } = await admin.from("staff").select("id").limit(1);
        if (error && error.code === "PGRST116") {
          return success({ exists: false, message: "Staff table does not exist" });
        }
      } catch {
        return success({ exists: false, message: "Staff table does not exist" });
      }

      logger.info("[STAFF CHECK] Staff table exists", {
        userId: context.user.id,
      });

      // STEP 3: Return success response
      return success({ exists: true, message: "Staff table exists" });
    } catch (error) {
      logger.error("[STAFF CHECK] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
