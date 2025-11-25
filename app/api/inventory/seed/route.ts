import { NextRequest, NextResponse } from "next/server";
import { seedInventoryData } from "@/lib/inventory-seed";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

// POST /api/inventory/seed
// Seeds inventory data for a venue (for testing/demo purposes)
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const body = await req.json();
      const venue_id = context.venueId || body.venue_id;

    if (!venue_id) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    const result = await seedInventoryData(venue_id);

      return NextResponse.json(result);
    } catch (_error) {
      logger.error("[INVENTORY SEED API] Error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ error: "Failed to seed inventory data" }, { status: 500 });
    }
  }
);
