/**
 * Dashboard Analytics API Route
 * GET: Fetch combined dashboard metrics for a venue
 */

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { AnalyticsService } from "@/lib/services/AnalyticsService";

export const runtime = "nodejs";

/**
 * GET: Fetch dashboard metrics
 */
export const GET = createUnifiedHandler(
  async (_req, context) => {
    const venueId = context.venueId;

    if (!venueId) {
      throw new Error("venueId is required");
    }

    const startTime = Date.now();
    const metrics = await AnalyticsService.getDashboardMetrics(venueId);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: metrics,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheHit: false,
        executionTimeMs: executionTime,
      },
    };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);
