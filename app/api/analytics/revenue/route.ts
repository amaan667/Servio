/**
 * Revenue Analytics API Route
 * GET: Fetch revenue analytics for a venue
 */

import { AnalyticsService } from "@/lib/services/AnalyticsService";
import { AnalyticsFilters, DateRangePreset } from "@/lib/analytics/types";
import { createUnifiedHandler } from "@/lib/api/unified-handler";

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
      case "today":
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date();
        break;
      case "yesterday":
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case "this_week":
        start = new Date(now);
        start.setDate(now.getDay() * -1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      case "last_week":
        start = new Date(now);
        start.setDate(now.getDay() * -1 - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case "last_month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "last_7_days":
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date();
    }
  } else if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    // Default: last 30 days
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
 * GET: Fetch revenue analytics
 */
export const GET = createUnifiedHandler(
  async (_req, context) => {
    const searchParams = _req.nextUrl.searchParams;
    const venueId = context.venueId;

    if (!venueId) {
      throw new Error("venueId is required");
    }

    // Parse filters
    const dateRange = parseDateRange(searchParams);
    const filters: AnalyticsFilters = {
      dateRange,
      venueId,
    };

    // Get analytics
    const startTime = Date.now();
    const analytics = await AnalyticsService.getRevenueAnalytics(venueId, filters);
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
