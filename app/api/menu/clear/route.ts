import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { z } from "zod";

const clearMenuSchema = z.object({
  venue_id: z.string().min(1, "venue_id is required"),
});

export const POST = createUnifiedHandler(
  async (_request: NextRequest, context) => {
    const { venue_id } = context.body as z.infer<typeof clearMenuSchema>;

    const supabase = createAdminClient();

    // Use the comprehensive catalog clear function
    const clearOperations = [
      { table: "item_images", description: "item images" },
      { table: "item_aliases", description: "item aliases" },
      { table: "option_choices", description: "option choices" },
      { table: "options", description: "options" },
      { table: "menu_items", description: "menu items" },
      { table: "categories", description: "categories" },
    ];

    let totalDeleted = 0;
    const results: Record<string, number> = {
      /* Empty */
    };

    for (const operation of clearOperations) {
      const { count, error } = await supabase
        .from(operation.table)
        .delete()
        .eq("venue_id", venue_id)
        .select("*");

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to clear ${operation.description}: ${error.message}`,
          },
          { status: 500 }
        );
      }

      const deletedCount = count || 0;
      results[operation.table] = deletedCount;
      totalDeleted += deletedCount;
    }

    return NextResponse.json({
      ok: true,
      message: "All catalog data cleared successfully",
      deletedCount: totalDeleted,
      details: results,
    });
  },
  {
    schema: clearMenuSchema,
    requireVenueAccess: true,
    venueIdSource: "body",
    requireRole: ["owner", "manager"],
  }
);
