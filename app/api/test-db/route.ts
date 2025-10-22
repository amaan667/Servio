import { errorToContext } from '@/lib/utils/error-to-context';
// Test endpoint to verify database connection and table existence
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { apiLogger, logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    logger.debug("[TEST DB] Starting database test...");
    
    // Test 1: Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    
    logger.debug("[TEST DB] User:", user ? "authenticated" : "not authenticated");
    
    // Test 2: Check if ai_chat_conversations table exists
    logger.debug("[TEST DB] Testing ai_chat_conversations table...");
    const { data: conversations, error: convError } = await supabase
      .from("ai_chat_conversations")
      .select("count")
      .limit(1);
    
    if (convError) {
      logger.debug("[TEST DB] ai_chat_conversations error:", convError);
      return NextResponse.json({
        success: false,
        error: "ai_chat_conversations table error",
        details: convError.message,
        code: convError.code,
        suggestion: "Run the SQL migration script in Supabase"
      }, { status: 500 });
    }
    
    // Test 3: Check if ai_chat_messages table exists
    logger.debug("[TEST DB] Testing ai_chat_messages table...");
    const { data: messages, error: msgError } = await supabase
      .from("ai_chat_messages")
      .select("count")
      .limit(1);
    
    if (msgError) {
      logger.debug("[TEST DB] ai_chat_messages error:", msgError);
      return NextResponse.json({
        success: false,
        error: "ai_chat_messages table error", 
        details: msgError.message,
        code: msgError.code,
        suggestion: "Run the SQL migration script in Supabase"
      }, { status: 500 });
    }
    
    // Test 4: Try to fetch conversations (if user is authenticated)
    if (user) {
      logger.debug("[TEST DB] Testing conversation fetch...");
      const { data: testConversations, error: fetchError } = await supabase
        .from("ai_chat_conversations")
        .select("*")
        .eq("user_id", user.id)
        .limit(5);
        
      if (fetchError) {
        logger.debug("[TEST DB] Fetch conversations error:", fetchError);
        return NextResponse.json({
          success: false,
          error: "Failed to fetch conversations",
          details: fetchError.message,
          code: fetchError.code
        }, { status: 500 });
      }
      
      logger.debug("[TEST DB] Found conversations:", testConversations?.length || 0);
    }
    
    logger.debug("[TEST DB] All tests passed!");
    
    return NextResponse.json({
      success: true,
      message: "Database connection and tables are working correctly",
      user: user ? "authenticated" : "not authenticated",
      conversationsFound: user ? "tested" : "skipped (no user)"
    });
    
  } catch (error) {
    logger.error("[TEST DB] Unexpected error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error.message
    }, { status: 500 });
  }
}
