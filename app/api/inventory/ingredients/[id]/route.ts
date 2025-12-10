import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import type { UpdateIngredientRequest } from "@/types/inventory";
import { logger } from "@/lib/logger";
import { success, apiErrors } from "@/lib/api/standard-response";

type IngredientRouteContext = {
  params?: {
    id?: string;
  };
};

// PATCH /api/inventory/ingredients/[id]
export async function PATCH(_request: NextRequest, context?: IngredientRouteContext) {
  try {
    const supabase = await createClient();
    const id = context?.params?.id;

    if (!id) {
      return apiErrors.badRequest("id is required");
    }
    const body: UpdateIngredientRequest = await _request.json();

    const { data, error } = await supabase
      .from("ingredients")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("[INVENTORY API] Error updating ingredient", {
        error: error.message,
      });
      return apiErrors.internal(error.message || 'Internal server error');
    }

    return success({ data });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[INVENTORY API] Unexpected error", {
      error: errorMessage,
    });
    return apiErrors.internal('Internal server error');
  }
}

// DELETE /api/inventory/ingredients/[id]
export async function DELETE(_request: NextRequest, context?: IngredientRouteContext) {
  try {
    const supabase = await createClient();
    const id = context?.params?.id;

    if (!id) {
      return apiErrors.badRequest("id is required");
    }

    const { error } = await supabase.from("ingredients").delete().eq("id", id);

    if (error) {
      logger.error("[INVENTORY API] Error deleting ingredient", {
        error: error.message,
      });
      return apiErrors.internal(error.message || 'Internal server error');
    }

    return success({});
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[INVENTORY API] Unexpected error", {
      error: errorMessage,
    });
    return apiErrors.internal('Internal server error');
  }
}
