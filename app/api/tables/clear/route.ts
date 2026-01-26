import { NextRequest } from "next/server";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success } from "@/lib/api/standard-response";

export const POST = createUnifiedHandler(async (_req: NextRequest) => {
  return success({ message: "All table sessions cleared" });
}, {
  requireVenueAccess: true,
  rateLimit: RATE_LIMITS.GENERAL,
});
