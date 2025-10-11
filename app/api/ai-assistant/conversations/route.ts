// AI Assistant Conversations API
// Handles creating and listing chat conversations

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateConversationSchema = z.object({
  venueId: z.string().min(1),
  title: z.string().min(1).max(255),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");

    console.log("[AI CHAT] Request venueId:", venueId);

    if (!venueId) {
      return NextResponse.json({ error: "Missing venueId" }, { status: 400 });
    }

    // Try to get user from auth, but don't fail if not available
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[AI CHAT] Auth check - user:", user ? "authenticated" : "not authenticated");

    let conversations, error;

    // If user is authenticated, verify venue access
    if (user) {
      const { data: venue } = await adminSupabase
        .from("venues")
        .select("owner_id")
        .eq("venue_id", venueId)
        .single();

      console.log("[AI CHAT] Venue check - found:", !!venue, "owner_id:", venue?.owner_id, "user_id:", user.id);

      if (!venue || venue.owner_id !== user.id) {
        console.log("[AI CHAT] Access denied - venue not found or user not owner");
        return NextResponse.json(
          { error: "Access denied to this venue" },
          { status: 403 }
        );
      }

      // Get conversations for this venue using admin client
      const result = await adminSupabase
        .from("ai_chat_conversations")
        .select("*")
        .eq("venue_id", venueId)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      
      conversations = result.data;
      error = result.error;
    } else {
      // If no user auth, try to get conversations anyway (for development/testing)
      console.log("[AI CHAT] No user auth - attempting to get conversations for venue");
      const result = await adminSupabase
        .from("ai_chat_conversations")
        .select("*")
        .eq("venue_id", venueId)
        .order("updated_at", { ascending: false });
      
      conversations = result.data;
      error = result.error;
    }

    if (error) {
      console.error("[AI CHAT] Failed to fetch conversations:", error);
      
      // Check if it's a table not found error
      if (error.code === 'PGRST116' || error.message?.includes('relation "ai_chat_conversations" does not exist')) {
        return NextResponse.json(
          { 
            error: "Chat tables not found. Please run the database migration.",
            migrationNeeded: true,
            instructions: "Run the SQL from migrations/ai-chat-schema.sql in your database"
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to fetch conversations", details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match frontend expectations
    const transformedConversations = (conversations || []).map(conv => ({
      ...conv,
      updatedAt: conv.updated_at,
      createdAt: conv.created_at,
      venueId: conv.venue_id,
      userId: conv.user_id,
      isActive: conv.is_active,
    }));

    return NextResponse.json({
      conversations: transformedConversations,
    });
  } catch (error: any) {
    console.error("[AI CHAT] Conversations error:", error);
    console.error("[AI CHAT] Error details:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        details: error.details,
        code: error.code
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    // Parse request body
    const body = await request.json();
    const { venueId, title } = CreateConversationSchema.parse(body);

    console.log("[AI CHAT CONVERSATION POST] Creating conversation:", { venueId, title });

    // Try to get user from auth, but don't fail if not available
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[AI CHAT CONVERSATION POST] Auth check - user:", user ? "authenticated" : "not authenticated");

    // Create new conversation using admin client (skip user verification for now)
    const { data: conversation, error } = await adminSupabase
      .from("ai_chat_conversations")
      .insert({
        venue_id: venueId,
        user_id: user?.id || "anonymous", // Use user ID if available, otherwise anonymous
        title,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[AI CHAT] Failed to create conversation:", error);
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    // Transform the created conversation to match frontend expectations
    const transformedConversation = {
      ...conversation,
      updatedAt: conversation.updated_at,
      createdAt: conversation.created_at,
      venueId: conversation.venue_id,
      userId: conversation.user_id,
      isActive: conversation.is_active,
    };

    return NextResponse.json({
      conversation: transformedConversation,
    });
  } catch (error: any) {
    console.error("[AI CHAT] Create conversation error:", error);
    
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

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { conversationId, title } = body;

    if (!conversationId || !title) {
      return NextResponse.json(
        { error: "Missing conversationId or title" },
        { status: 400 }
      );
    }

    // Verify user has access to this conversation using admin client
    const { data: conversation } = await adminSupabase
      .from("ai_chat_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Update the conversation title using admin client
    const { data: updatedConversation, error } = await adminSupabase
      .from("ai_chat_conversations")
      .update({ 
        title,
        updated_at: new Date().toISOString()
      })
      .eq("id", conversationId)
      .select("*")
      .single();

    if (error) {
      console.error("[AI CHAT] Failed to update conversation:", error);
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }

    // Transform the updated conversation to match frontend expectations
    const transformedConversation = {
      ...updatedConversation,
      updatedAt: updatedConversation.updated_at,
      createdAt: updatedConversation.created_at,
      venueId: updatedConversation.venue_id,
      userId: updatedConversation.user_id,
      isActive: updatedConversation.is_active,
    };

    return NextResponse.json({
      conversation: transformedConversation,
    });
  } catch (error: any) {
    console.error("[AI CHAT] Update conversation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

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
