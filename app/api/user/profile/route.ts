import { NextRequest } from "next/server";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

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

      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      // Return user profile data (excluding sensitive information)
      const profile = {

      };

      // STEP 7: Return success response
      return success({ profile });
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

export const PUT = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Parse request
      await req.json(); // Body parsed but not used in this example

      // STEP 4: Validate inputs (none required for this example)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      // Here you would typically update user metadata or profile data
      // For this example, we'll just return the current user data

      // STEP 7: Return success response
      return success({

        },

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
