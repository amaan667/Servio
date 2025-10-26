// AI Assistant Individual Conversation API
// Handles operations on a specific conversation (DELETE, etc.)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const adminSupabase = createAdminClient();

    const { conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversation ID" }, { status: 400 });
    }

    logger.debug("[AI CHAT DELETE] Deleting conversation:", { conversationId });

    // Delete the conversation (messages will be cascade deleted due to foreign key)
    const { error } = await adminSupabase
      .from("ai_chat_conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      logger.error("[AI CHAT] Failed to delete conversation:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
    }

    logger.debug("[AI CHAT] Conversation deleted successfully");
    return NextResponse.json({ success: true });
  } catch (_error) {
    logger._error("[AI CHAT] Delete conversation error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}
