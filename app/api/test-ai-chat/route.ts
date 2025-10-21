// Test endpoint to debug AI chat issues
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getSession();

    logger.debug("[TEST] Auth check:", { 
      user: user ? { id: user.id, email: user.email } : null,
      authError 
    });

    if (!user) {
      return NextResponse.json({ error: "No authenticated user" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");

    logger.debug("[TEST] Request venueId:", venueId);

    if (!venueId) {
      return NextResponse.json({ error: "Missing venueId" }, { status: 400 });
    }

    // Test venue access
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_id, venue_name, owner_user_id")
      .eq("venue_id", venueId)
      .single();

    logger.debug("[TEST] Venue check:", { data: { venue, extra: venueError } });

    if (!venue) {
      return NextResponse.json({ 
        error: "Venue not found",
        venueError: venueError?.message 
      }, { status: 404 });
    }

    if (venue.owner_user_id !== user.id) {
      return NextResponse.json({ 
        error: "User is not venue owner",
        venueOwnerId: venue.owner_user_id,
        userId: user.id 
      }, { status: 403 });
    }

    // Test table access
    const { data: conversations, error: conversationsError } = await supabase
      .from("ai_chat_conversations")
      .select("*")
      .eq("venue_id", venueId);

    logger.debug("[TEST] Conversations query:", { 
      conversations, 
      conversationsError,
      count: conversations?.length || 0 
    });

    // Test messages table
    const { data: messages, error: messagesError } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .limit(5);

    logger.debug("[TEST] Messages query:", { 
      messages, 
      messagesError,
      count: messages?.length || 0 
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      venue: { id: venue.venue_id, name: venue.venue_name, owner_id: venue.owner_user_id },
      conversations: {
        count: conversations?.length || 0,
        data: conversations || [],
        error: conversationsError?.message
      },
      messages: {
        count: messages?.length || 0,
        data: messages || [],
        error: messagesError?.message
      }
    });

  } catch (error: any) {
    logger.error("[TEST] Error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error.message 
    }, { status: 500 });
  }
}
