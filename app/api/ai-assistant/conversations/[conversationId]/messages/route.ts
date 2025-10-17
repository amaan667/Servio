// AI Assistant Messages API
// Handles messages within conversations

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateConversationTitle } from "@/lib/ai/openai-service";
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
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    const { conversationId } = await params;

    // Try to get user from auth, but don't fail if not available
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[AI CHAT MESSAGES] Auth check - user:", user ? "authenticated" : "not authenticated");

    // Get messages for this conversation using admin client
    // Skip user verification for now to allow development/testing
    const { data: messages, error } = await adminSupabase
      .from("ai_chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[AI CHAT] Failed to fetch messages:", error);
      
      // If table doesn't exist, return empty messages array
      if (error.code === 'PGRST116' || error.message?.includes('relation "ai_chat_messages" does not exist')) {
        return NextResponse.json({
          messages: [],
        });
      }
      
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    // Transform messages to match frontend expectations
    const transformedMessages = (messages || []).map(msg => ({
      ...msg,
      createdAt: msg.created_at,
    }));

    return NextResponse.json({
      messages: transformedMessages,
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
    const adminSupabase = createAdminClient();
    
    const { conversationId } = await params;

    // Try to get user from auth, but don't fail if not available
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[AI CHAT MESSAGES POST] Auth check - user:", user ? "authenticated" : "not authenticated");

    // Parse request body
    const body = await request.json();
    const messageData = CreateMessageSchema.parse(body);

    console.log("[AI CHAT MESSAGES POST] Creating message:", { conversationId, messageData });

    // Create new message using admin client (skip user verification for now)
    const { data: message, error } = await adminSupabase
      .from("ai_chat_messages")
      .insert({
        conversation_id: conversationId,
        ...messageData,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[AI CHAT] Failed to create message:", error);
      
      // If table doesn't exist, return a mock message
      if (error.code === 'PGRST116' || error.message?.includes('relation "ai_chat_messages" does not exist')) {
        return NextResponse.json({
          message: {
            id: `temp-${Date.now()}`,
            conversation_id: conversationId,
            role: messageData.role,
            content: messageData.content,
            created_at: new Date().toISOString(),
          },
        });
      }
      
      return NextResponse.json(
        { error: "Failed to create message" },
        { status: 500 }
      );
    }

    console.log("[AI CHAT MESSAGES POST] Message created successfully:", message);

    // Generate AI-powered conversation title if this is the first user message
    if (messageData.role === "user") {
      // Check if this is the first user message in the conversation
      const { data: userMessages } = await adminSupabase
        .from("ai_chat_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("role", "user");

      // If this is the first user message, generate a proper title
      if (userMessages && userMessages.length === 1) {
        try {
          const aiTitle = await generateConversationTitle(messageData.content);
          await adminSupabase
            .from("ai_chat_conversations")
            .update({ 
              title: aiTitle,
              updated_at: new Date().toISOString() 
            })
            .eq("id", conversationId);
          console.log("[AI CHAT] Updated conversation title to:", aiTitle);
        } catch (error) {
          console.error("[AI CHAT] Failed to generate title:", error);
          // Continue without failing the message creation
        }
      }
    }

    // Update conversation's updated_at timestamp using admin client
    await adminSupabase
      .from("ai_chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    // Transform the created message to match frontend expectations
    const transformedMessage = {
      ...message,
      createdAt: message.created_at,
    };

    return NextResponse.json({
      message: transformedMessage,
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