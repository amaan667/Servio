import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.supabase) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { supabase } = auth;

    // Get current table to increment qr_version
    const { data: currentTable, error: fetchError } = await supabase
      .from("tables")
      .select("qr_version")
      .eq("id", tableId)
      .single();

    if (fetchError || !currentTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Increment qr_version
    const { data: table, error } = await supabase
      .from("tables")
      .update({
        qr_version: ((currentTable as { qr_version?: number }).qr_version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tableId)
      .select()
      .single();

    if (error) {
      logger.error("[TABLES API] Error reissuing QR:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to reissue QR" }, { status: 500 });
    }

    return NextResponse.json({ table });
  } catch (_error) {
    logger.error("[TABLES API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
