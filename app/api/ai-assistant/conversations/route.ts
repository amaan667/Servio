// AI Assistant Conversations API
// Handles creating and listing chat conversations

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { z } from "zod";
import { apiLogger, logger } from '@/lib/logger';

const CreateConversationSchema = z.object({
  venueId: z.string().min(1),
  title: z.string().min(1).max(255),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient('server');
    const adminSupabase = await createSupabaseClient('admin');
    
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");

    logger.debug("[AI CHAT] Request venueId:", { venueId });

    if (!venueId) {
      return NextResponse.json({ error: "Missing venueId" }, { status: 400 });
    }

    // Try to get user from auth, but don't fail if not available
    const {
      data: { user },
    } = await supabase.auth.getUser();

    logger.debug("[AI CHAT] Auth check - user:", { authenticated: !!user });

    let conversations, error;

    // If user is authenticated, verify venue access
    if (user) {
      // Try role-based access first
      let roleName: string | null = null;
      try {
        const { data: roleRow, error: roleErr } = await adminSupabase
          .from('user_venue_roles')
          .select('role')
          .eq('venue_id', venueId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!roleErr && roleRow?.role) {
          roleName = roleRow.role;
        }
      } catch (e) {
        logger.debug('[AI CHAT] user_venue_roles lookup failed, will fallback to ownership check', { error: e instanceof Error ? e.message : 'Unknown error' });
      }

      if (!roleName) {
        // Fallback to owner check
        const { data: venue } = await adminSupabase
          .from("venues")
          .select("owner_id")
          .eq("venue_id", venueId)
          .single();

        logger.debug("[AI CHAT] Venue check - found:", { found: !!venue, owner_id: venue?.owner_id, user_id: user.id });

        if (!venue || venue.owner_id !== user.id) {
          logger.debug("[AI CHAT] Access denied - no role and user not owner");
          return NextResponse.json(
            { error: "Access denied to this venue" },
            { status: 403 }
          );
        }
        roleName = 'owner';
      }

      logger.debug('[AI CHAT] Access granted with role:', { userId: user.id, venueId, role: roleName });

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
      logger.debug("[AI CHAT] No user auth - attempting to get conversations for venue");
      const result = await adminSupabase
        .from("ai_chat_conversations")
        .select("*")
        .eq("venue_id", venueId)
        .order("updated_at", { ascending: false });
      
      conversations = result.data;
      error = result.error;
    }

    if (error) {
      logger.error("[AI CHAT] Failed to fetch conversations:", { error: error instanceof Error ? error.message : 'Unknown error' });
      
      // Check if it's a table not found error - return empty conversations instead of error
      if (error.code === 'PGRST116' || error.message?.includes('relation "ai_chat_conversations" does not exist')) {
        return NextResponse.json({
          conversations: [],
        });
      }
      
      return NextResponse.json(
        { error: "Failed to fetch conversations", details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match frontend expectations
    const transformedConversations = (conversations || []).map((conv: unknown) => ({
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
  } catch (error: unknown) {
    logger.error("[AI CHAT] Conversations error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    logger.error("[AI CHAT] Error details:", {
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
    const supabase = await createSupabaseClient('server');
    const adminSupabase = await createSupabaseClient('admin');
    
    // Parse request body
    const body = await request.json();
    const { venueId, title } = CreateConversationSchema.parse(body);

    logger.debug("[AI CHAT CONVERSATION POST] Creating conversation:", { venueId, title });

    // Try to get user from auth, but don't fail if not available
    const {
      data: { user },
    } = await supabase.auth.getUser();

    logger.debug("[AI CHAT CONVERSATION POST] Auth check - user:", { authenticated: !!user });

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
      logger.error("[AI CHAT] Failed to create conversation:", { error: error instanceof Error ? error.message : 'Unknown error' });
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
  } catch (error: unknown) {
    logger.error("[AI CHAT] Create conversation error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    
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
    const supabase = await createSupabaseClient('server');
    const adminSupabase = await createSupabaseClient('admin');
    
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
      logger.error("[AI CHAT] Failed to update conversation:", { error: error instanceof Error ? error.message : 'Unknown error' });
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
  } catch (error: unknown) {
    logger.error("[AI CHAT] Update conversation error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

