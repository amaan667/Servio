import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const GET = createUnifiedHandler(
  async (_req: NextRequest) => {
    // Business logic
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

    return success({ exists: true, message: "Staff table exists" });
  },
  {
    requireAuth: true,
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
