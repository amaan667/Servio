import { NextRequest } from "next/server";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success } from "@/lib/api/standard-response";

export const GET = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get user from context (already verified)
    const user = context.user;

    // Return user profile data (excluding sensitive information)
    const profile = {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    };

    return success({ profile });
  },
  {
    requireAuth: true,
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);

export const PUT = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get user from context (already verified)
    const user = context.user;

    // Body parsed but not used in this example
    // Here you would typically update user metadata or profile data
    // For this example, we'll just return the current user data

    return success({
      message: "Profile update endpoint",
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
    });
  },
  {
    requireAuth: true,
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
