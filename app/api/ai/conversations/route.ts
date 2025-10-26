// Production AI Conversations API
// Implements proper venue access control and RLS

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(_request.url);
    const venueId = searchParams.get("venueId");
    const cursor = searchParams.get("cursor") || "0";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!venueId) {
      return NextResponse.json({ error: "Missing venueId" }, { status: 400 });
    }

    // Verify user has access to venue
    const { data: venue } = await supabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", venueId)
      .single();

    if (!venue || venue.owner_user_id !== user.id) {
      return NextResponse.json({ error: "Access denied to this venue" }, { status: 403 });
    }

    // Get conversations for this venue
    const { data: conversations, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("venue_id", venueId)
      .order("last_message_at", { ascending: false })
      .range(parseInt(cursor), parseInt(cursor) + limit - 1);

    if (error) {
      logger.error("[AI CHAT] Failed to fetch conversations:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        { error: "Failed to fetch conversations", details: error.message },
        { status: 500 }
      );
    }

    // Transform data to match frontend expectations
    const transformedConversations = (conversations || []).map((conv) => ({
      id: conv.id,
      title: conv.title,
      venueId: conv.venue_id,
      createdBy: conv.created_by,
      lastMessageAt: conv.last_message_at,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    }));

    return NextResponse.json({
      conversations: transformedConversations,
      hasMore: conversations?.length === limit,
      nextCursor: conversations?.length === limit ? (parseInt(cursor) + limit).toString() : null,
    });
  } catch (_error) {
    logger.error("[AI CHAT] Conversations error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await _request.json();
    const { venueId, title } = body;

    if (!venueId) {
      return NextResponse.json({ error: "Missing venueId" }, { status: 400 });
    }

    // Verify user has access to venue
    const { data: venue } = await supabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", venueId)
      .single();

    if (!venue || venue.owner_user_id !== user.id) {
      return NextResponse.json({ error: "Access denied to this venue" }, { status: 403 });
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from("ai_conversations")
      .insert({
        venue_id: venueId,
        created_by: user.id,
        title: title || "New Conversation",
      })
      .select("*")
      .single();

    if (error) {
      logger.error("[AI CHAT] Failed to create conversation:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    // Transform the created conversation
    const transformedConversation = {
      id: conversation.id,
      title: conversation.title,
      venueId: conversation.venue_id,
      createdBy: conversation.created_by,
      lastMessageAt: conversation.last_message_at,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    };

    return NextResponse.json({
      conversation: transformedConversation,
    });
  } catch (_error) {
    logger.error("[AI CHAT] Create conversation error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}

export async function PATCH(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await _request.json();
    const { conversationId, title } = body;

    if (!conversationId || !title) {
      return NextResponse.json({ error: "Missing conversationId or title" }, { status: 400 });
    }

    // Verify user has access to this conversation
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Verify venue access
    const { data: venue } = await supabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", conversation.venue_id)
      .single();

    if (!venue || venue.owner_user_id !== user.id) {
      return NextResponse.json({ error: "Access denied to this venue" }, { status: 403 });
    }

    // Update the conversation title
    const { data: updatedConversation, error } = await supabase
      .from("ai_conversations")
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .select("*")
      .single();

    if (error) {
      logger.error("[AI CHAT] Failed to update conversation:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
    }

    // Transform the updated conversation
    const transformedConversation = {
      id: updatedConversation.id,
      title: updatedConversation.title,
      venueId: updatedConversation.venue_id,
      createdBy: updatedConversation.created_by,
      lastMessageAt: updatedConversation.last_message_at,
      createdAt: updatedConversation.created_at,
      updatedAt: updatedConversation.updated_at,
    };

    return NextResponse.json({
      conversation: transformedConversation,
    });
  } catch (_error) {
    logger.error("[AI CHAT] Update conversation error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}
