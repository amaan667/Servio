import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

// GET /api/inventory/export/csv?venue_id=xxx
// CSV exports require Enterprise tier
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 3: Check tier - CSV exports require Enterprise tier
      // IMPORTANT: Tier is computed by unified auth based on the venue owner's subscription.
      // Staff accounts should not downgrade the venue's plan.
      if (context.tier !== "enterprise") {
        return apiErrors.forbidden("CSV exports require Enterprise tier", {

      }

      // STEP 4: Business logic - Fetch ingredients
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("v_stock_levels")
        .select("*")
        .eq("venue_id", venueId)
        .order("name", { ascending: true });

      if (error) {
        
        return apiErrors.database(
          "Failed to fetch inventory data",
          isDevelopment() ? error.message : undefined
        );
      }

      // STEP 5: Generate CSV
      const headers = [
        "Name",
        "SKU",
        "Unit",
        "Cost Per Unit",
        "On Hand",
        "Par Level",
        "Reorder Level",
        "Supplier",
      ];

      const csvRows = [
        headers.join(","),
        ...(data || []).map((item) =>
          [
            `"${item.name || ""}"`,
            `"${item.sku || ""}"`,
            item.unit || "",
            item.cost_per_unit || 0,
            item.on_hand || 0,
            item.par_level || 0,
            item.reorder_level || 0,
            `"${item.supplier || ""}"`,
          ].join(",")
        ),
      ];

      const csv = csvRows.join("\n");

      

      // STEP 6: Return CSV response
      return new NextResponse(csv, {

          "Content-Disposition": `attachment; filename="inventory-${venueId}-${new Date().toISOString().split("T")[0]}.csv"`,
        },

    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from query params

        const { searchParams } = new URL(req.url);
        return searchParams.get("venue_id") || searchParams.get("venueId");
      } catch {
        return null;
      }
    },
  }
);
