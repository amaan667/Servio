// Test endpoint to verify database connection and table existence
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    console.log("[TEST DB] Starting database test...");
    
    // Test 1: Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    console.log("[TEST DB] User:", user ? "authenticated" : "not authenticated");
    
    // Test 2: Check if ai_chat_conversations table exists
    console.log("[TEST DB] Testing ai_chat_conversations table...");
    const { data: conversations, error: convError } = await supabase
      .from("ai_chat_conversations")
      .select("count")
      .limit(1);
    
    if (convError) {
      console.log("[TEST DB] ai_chat_conversations error:", convError);
      return NextResponse.json({
        success: false,
        error: "ai_chat_conversations table error",
        details: convError.message,
        code: convError.code,
        suggestion: "Run the SQL migration script in Supabase"
      }, { status: 500 });
    }
    
    // Test 3: Check if ai_chat_messages table exists
    console.log("[TEST DB] Testing ai_chat_messages table...");
    const { data: messages, error: msgError } = await supabase
      .from("ai_chat_messages")
      .select("count")
      .limit(1);
    
    if (msgError) {
      console.log("[TEST DB] ai_chat_messages error:", msgError);
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
      console.log("[TEST DB] Testing conversation fetch...");
      const { data: testConversations, error: fetchError } = await supabase
        .from("ai_chat_conversations")
        .select("*")
        .eq("user_id", user.id)
        .limit(5);
        
      if (fetchError) {
        console.log("[TEST DB] Fetch conversations error:", fetchError);
        return NextResponse.json({
          success: false,
          error: "Failed to fetch conversations",
          details: fetchError.message,
          code: fetchError.code
        }, { status: 500 });
      }
      
      console.log("[TEST DB] Found conversations:", testConversations?.length || 0);
    }
    
    console.log("[TEST DB] All tests passed!");
    
    return NextResponse.json({
      success: true,
      message: "Database connection and tables are working correctly",
      user: user ? "authenticated" : "not authenticated",
      conversationsFound: user ? "tested" : "skipped (no user)"
    });
    
  } catch (error: any) {
    console.error("[TEST DB] Unexpected error:", error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error.message
    }, { status: 500 });
  }
}
