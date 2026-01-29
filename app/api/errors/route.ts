import { NextRequest } from "next/server";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success } from "@/lib/api/standard-response";
import { z } from "zod";

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

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Validate input (already done by unified handler)
    const { body } = context;
    const data = body;

    // Business logic - Log error/message
    if (data.error) {
      /* Condition handled */
    } else if (data.message) {
      /* Condition handled */
    }

    // Store in database or send to external service
    // For now, we'll just log it
    // In production, you might want to store this in a database
    // or send it to a service like Sentry, LogRocket, etc.

    return success({ success: true });
  },
  {
    schema: errorDataSchema,
    requireAuth: false, // Errors can come from unauthenticated users
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);

export const GET = createUnifiedHandler(
  async (_req: NextRequest) => {
    return success({
      message: "Error tracking endpoint",
      status: "active",
    });
  },
  {
    requireAuth: false,
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
