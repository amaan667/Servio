// AI Assistant Individual Conversation API
// Handles operations on a specific conversation (DELETE, etc.)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const adminSupabase = createAdminClient();
    
    const { conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversation ID" },
        { status: 400 }
      );
    }

    console.log("[AI CHAT DELETE] Deleting conversation:", conversationId);

    // Delete the conversation (messages will be cascade deleted due to foreign key)
    const { error } = await adminSupabase
      .from("ai_chat_conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      console.error("[AI CHAT] Failed to delete conversation:", error);
      return NextResponse.json(
        { error: "Failed to delete conversation" },
        { status: 500 }
      );
    }

    console.log("[AI CHAT] Conversation deleted successfully");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[AI CHAT] Delete conversation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
