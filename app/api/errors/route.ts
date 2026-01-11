import { NextRequest } from "next/server";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

const errorDataSchema = z.object({

    .optional(),

    .optional(),

  }),

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const data = await validateBody(errorDataSchema, await req.json());

      // STEP 3: Business logic - Log error/message
      if (data.error) {
        .toISOString(),

      } else if (data.message) {
        }: ${data.message.text}`, {

      }

      // Store in database or send to external service
      // For now, we'll just log it
      // In production, you might want to store this in a database
      // or send it to a service like Sentry, LogRocket, etc.

      // STEP 4: Return success response
      return success({ success: true });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Failed to process error", isDevelopment() ? error : undefined);
    }
  },
  {
    // System route - no venue required (errors can come from anywhere)

  }
);

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Return success response
      return success({

    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // System route - no venue required

  }
);
