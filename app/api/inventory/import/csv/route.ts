import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import type { IngredientUnit } from "@/types/inventory";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

interface CSVRow {
  name: string;
  sku?: string;
  unit: IngredientUnit | string;
  cost_per_unit: number | string;
  on_hand: number | string;
  par_level: number | string;
  reorder_level: number | string;
  supplier?: string;
}

export const runtime = "nodejs";

// POST /api/inventory/import/csv
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const supabase = createAdminClient();
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const venue_id = context.venueId || (formData.get("venue_id") as string);

      if (!file || !venue_id) {
        return apiErrors.badRequest("file and venue_id are required");
      }

      // STEP 3: Business logic
      // Read CSV content
      const content = await file.text();
      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        return apiErrors.badRequest("CSV file is empty or invalid");
      }

      // Parse CSV (simple parser - assumes no commas in quoted fields)
      const headerLine = lines[0];
      if (!headerLine) {
        return apiErrors.badRequest("CSV file has no headers");
      }
      const headers = headerLine.split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      const rows: CSVRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const lineContent = lines[i];
        if (!lineContent) continue;
        const values = lineContent.split(",").map((v) => v.trim().replace(/"/g, ""));
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
          const value = values[index] || "";

          if (header.includes("name")) {
            row.name = value;
          } else if (header.includes("sku")) {
            row.sku = value;
          } else if (header.includes("unit")) {
            row.unit = value;
          } else if (header.includes("cost")) {
            row.cost_per_unit = (parseFloat(value) || 0).toString();
          } else if (header.includes("on") && header.includes("hand")) {
            row.on_hand = (parseFloat(value) || 0).toString();
          } else if (header.includes("par")) {
            row.par_level = (parseFloat(value) || 0).toString();
          } else if (header.includes("reorder")) {
            row.reorder_level = (parseFloat(value) || 0).toString();
          } else if (header.includes("supplier")) {
            row.supplier = value;
          }
        });

        if (
          row.name &&
          row.unit &&
          row.cost_per_unit &&
          row.on_hand &&
          row.par_level &&
          row.reorder_level
        ) {
          rows.push({
            name: row.name,
            unit: row.unit,
            cost_per_unit: row.cost_per_unit,
            on_hand: row.on_hand,
            par_level: row.par_level,
            reorder_level: row.reorder_level,
            sku: row.sku,
            supplier: row.supplier,
          } as CSVRow);
        }
      }

      if (rows.length === 0) {
        return apiErrors.badRequest("No valid rows found in CSV");
      }

      // Get current user - use getUser() for secure authentication
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        return apiErrors.unauthorized("Unauthorized");
      }

      const imported: string[] = [];
      const errors: Array<{ row: string; error: string }> = [];

      // Process each row
      for (const row of rows) {
        try {
          // Upsert ingredient
          const { data: ingredient, error: ingredientError } = await supabase
            .from("ingredients")
            .upsert(
              {
                venue_id,
                name: row.name,
                sku: row.sku,
                unit: row.unit,
                cost_per_unit: row.cost_per_unit,
                par_level: row.par_level,
                reorder_level: row.reorder_level,
                supplier: row.supplier,
              },
              {
                onConflict: "venue_id,name",
              }
            )
            .select()
            .single();

          if (ingredientError) {
            errors.push({ row: row.name, error: ingredientError.message });
            continue;
          }

          // If on_hand is provided and > 0, create a receive ledger entry
          const onHandValue =
            typeof row.on_hand === "string" ? parseFloat(row.on_hand) : row.on_hand;
          if (onHandValue && onHandValue > 0) {
            // Check if we need to set initial stock or adjust
            const { data: currentStock } = await supabase
              .from("v_stock_levels")
              .select("on_hand")
              .eq("ingredient_id", ingredient.id)
              .single();

            const currentOnHand = currentStock?.on_hand || 0;
            const delta = onHandValue - currentOnHand;

            if (delta !== 0) {
              await supabase.from("stock_ledgers").insert({
                ingredient_id: ingredient.id,
                venue_id,
                delta,
                reason: "receive",
                ref_type: "manual",
                note: "Imported from CSV",
                created_by: currentUser?.id,
              });
            }
          }

          imported.push(ingredient.name);
        } catch (err: unknown) {
          errors.push({
            row: row.name,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      // STEP 4: Return success response
      return success({
        success: true,
        imported_count: imported.length,
        error_count: errors.length,
        imported,
        errors,
      });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Failed to import CSV", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from formData
    extractVenueId: async (req) => {
      try {
        // Clone the request so we don't consume the original body
        const clonedReq = req.clone();
        const formData = await clonedReq.formData();
        return (formData.get("venue_id") as string) || null;
      } catch {
        return null;
      }
    },
  }
);
