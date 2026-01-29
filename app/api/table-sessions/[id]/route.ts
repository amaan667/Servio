import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { success, apiErrors } from "@/lib/api/standard-response";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await req.json();
    const { status, order_id, closed_at } = body;

    const supabase = await createClient();

    // Update table session
    interface SessionUpdate {
      status: string;
      updated_at: string;
      order_id?: string | null;
      closed_at?: string | null;
    }

    const updateData: SessionUpdate = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (order_id !== undefined) {
      updateData.order_id = order_id;
    }

    if (closed_at !== undefined) {
      updateData.closed_at = closed_at;
    }

    const { data: session, error } = await supabase
      .from("table_sessions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return apiErrors.database("Failed to update table session");
    }

    return success({ session });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";

    return apiErrors.internal("Internal server error");
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const supabase = await createClient();

    // Delete table session
    const { error } = await supabase.from("table_sessions").delete().eq("id", id);

    if (error) {
      return apiErrors.database("Failed to delete table session");
    }

    return success({});
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";

    return apiErrors.internal("Internal server error");
  }
}
