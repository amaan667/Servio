/**
 * Customer Analytics API Route
 * GET: Fetch customer analytics for a venue
 */

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { AnalyticsService } from "@/lib/services/AnalyticsService";
import { AnalyticsFilters, DateRangePreset } from "@/lib/analytics/types";

export const runtime = "nodejs";

/**
 * Parse date range from query parameters
 */
function parseDateRange(searchParams: URLSearchParams): AnalyticsFilters["dateRange"] {
  const preset = searchParams.get("preset") as DateRangePreset | null;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const now = new Date();
  let start: Date;
  let end: Date;

  if (preset && preset !== "custom") {
    switch (preset) {
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case "last_30_days":
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        end = new Date();
        break;
      case "last_90_days":
        start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        end = new Date();
        break;
      default:
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        end = new Date();
    }
  } else if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    end = new Date();
  }

  return {
    start,
    end,
    preset: preset || "last_30_days",
  };
}

/**
 * GET: Fetch customer analytics
 */
export const GET = createUnifiedHandler(
  async (_req, context) => {
    const searchParams = _req.nextUrl.searchParams;
    const venueId = context.venueId;

    if (!venueId) {
      throw new Error("venueId is required");
    }

    const dateRange = parseDateRange(searchParams);
    const filters: AnalyticsFilters = {
      dateRange,
      venueId,
    };

    const startTime = Date.now();
    const analytics = await AnalyticsService.getCustomerAnalytics(venueId, filters);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: analytics,
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
