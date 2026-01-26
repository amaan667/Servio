import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

const pilotFeedbackSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  description: z.string().min(1),
  email: z.string().email().optional(),
  userAgent: z.string().optional(),
  timestamp: z.string().optional(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body } = context;
    const { type, title, description, email, userAgent, timestamp } = body;

    // Validation already done by unified handler schema
    if (!description) {
      return apiErrors.badRequest("Description is required");
    }

    // Business logic
    const supabase = createAdminClient();

    // Store feedback in database
    const { error } = await supabase.from("feedback").insert({
      type: type || "general",
      title: title || `${type || "general"} submission`,
      description,
      email,
      user_agent: userAgent,
      created_at: timestamp || new Date().toISOString(),
      status: "pending",
    });

    if (error) {
      // Don't fail if database insert fails - log it silently
    }

    return success({});
  },
  {
    schema: pilotFeedbackSchema,
    requireAuth: false, // Pilot feedback can be anonymous
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
