import { NextRequest } from "next/server";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

const errorDataSchema = z.object({
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  message: z
    .object({
      text: z.string(),
      level: z.string(),
    })
    .optional(),
  context: z.object({
    userId: z.string().uuid().optional(),
    venueId: z.string().uuid().optional(),
    userRole: z.string().optional(),
    url: z.string().url(),
    timestamp: z.number(),
    userAgent: z.string(),
    sessionId: z.string(),
    customData: z.record(z.unknown()).optional(),
  }),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, _context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const data = await validateBody(errorDataSchema, await req.json());

      // STEP 3: Business logic - Log error/message
      if (data.error) { /* Condition handled */ } else if (data.message) { /* Condition handled */ }

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
    extractVenueId: async () => null,
  }
);

export const GET = withUnifiedAuth(
  async (req: NextRequest, _context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Return success response
      return success({
        message: "Error tracking endpoint",
        status: "active",
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
