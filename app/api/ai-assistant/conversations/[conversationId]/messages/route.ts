// AI Assistant Messages API
// Handles messages within conversations

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  toolName: z.string().optional(),
  toolParams: z.any().optional(),
  executionResult: z.any().optional(),
  auditId: z.string().uuid().optional(),
  canUndo: z.boolean().default(false),
  undoData: z.any().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    // Verify user has access to this conversation
    const { data: conversation } = await supabase
      .from("ai_chat_conversations")
      .select(`
        *,
        venues!inner(owner_id)
      `)
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (conversation.user_id !== user.id && conversation.venues.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied to this conversation" },
        { status: 403 }
      );
    }

    // Get messages for this conversation
    const { data: messages, error } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[AI CHAT] Failed to fetch messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      messages: messages || [],
    });
  } catch (error: any) {
    console.error("[AI CHAT] Messages error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    // Verify user has access to this conversation
    const { data: conversation } = await supabase
      .from("ai_chat_conversations")
      .select(`
        *,
        venues!inner(owner_id)
      `)
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (conversation.user_id !== user.id && conversation.venues.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied to this conversation" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const messageData = CreateMessageSchema.parse(body);

    // Create new message
    const { data: message, error } = await supabase
      .from("ai_chat_messages")
      .insert({
        conversation_id: conversationId,
        ...messageData,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[AI CHAT] Failed to create message:", error);
      return NextResponse.json(
        { error: "Failed to create message" },
        { status: 500 }
      );
    }

    // Update conversation's updated_at timestamp
    await supabase
      .from("ai_chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({
      message,
    });
  } catch (error: any) {
    console.error("[AI CHAT] Create message error:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}