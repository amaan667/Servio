import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import type { UpdateIngredientRequest } from "@/types/inventory";
import { logger } from "@/lib/logger";
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

// PATCH /api/inventory/ingredients/[id]
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body: UpdateIngredientRequest = await _request.json();

    const { data, error } = await supabase
      .from("ingredients")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[INVENTORY API] Error updating ingredient:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return apiErrors.internal(error.message || 'Internal server error');
    }

    return NextResponse.json({ data });
  } catch (_error) {
    logger.error("[INVENTORY API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal('Internal server error');
  }
}

// DELETE /api/inventory/ingredients/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { error } = await supabase.from("ingredients").delete().eq("id", id);

    if (error) {
      logger.error("[INVENTORY API] Error deleting ingredient:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return apiErrors.internal(error.message || 'Internal server error');
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("[INVENTORY API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return apiErrors.internal('Internal server error');
  }
}
