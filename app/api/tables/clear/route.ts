import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

export const POST = withUnifiedAuth(
  async (req: NextRequest, _context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit();
      }

      return success({ message: "All table sessions cleared" });
    } catch (_error) {
      logger.error("[TABLES CLEAR] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return apiErrors.internal('Internal server error');
    }
  }
);
