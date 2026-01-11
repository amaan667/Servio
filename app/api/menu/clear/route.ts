import { NextRequest, NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";
import { createAdminClient } from "@/lib/supabase";

export async function POST(_request: NextRequest) {
  try {
    const { venue_id } = await _request.json();

    if (!venue_id) {
      return apiErrors.badRequest("venue_id is required");
    }

    const supabase = await createAdminClient();

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

  } catch (_error) {
    
    return NextResponse.json(
      {

        error: `Clear menu failed: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
      },
      { status: 500 }
    );
  }
}
