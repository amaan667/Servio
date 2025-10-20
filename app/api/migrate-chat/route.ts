import { errorToContext } from '@/lib/utils/error-to-context';
// API endpoint to apply the AI Chat schema migration
// This can be called to set up the chat tables

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { apiLogger, logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    logger.debug("[MIGRATION] Starting AI Chat schema migration...");
    
    const supabase = await createClient();
    
    // Check if tables already exist
    const { data: conversationsCheck, error: convError } = await supabase
      .from('ai_chat_conversations')
      .select('*')
      .limit(1);
    
    const { data: messagesCheck, error: msgError } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .limit(1);
    
    const conversationsExist = !convError || convError.code !== 'PGRST116';
    const messagesExist = !msgError || msgError.code !== 'PGRST116';
    
    if (conversationsExist && messagesExist) {
      return NextResponse.json({
        success: true,
        message: "Chat tables already exist",
        tables: {
          conversations: true,
          messages: true
        }
      });
    }
    
    // Read the migration file
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.join(process.cwd(), 'migrations', 'ai-chat-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    logger.debug("[MIGRATION] Migration file loaded, size:", migrationSQL.length, "bytes");
    
    // Since we can't execute raw SQL through the Supabase client,
    // we'll provide detailed instructions
    return NextResponse.json({
      success: false,
      message: "Manual migration required",
      instructions: {
        step1: "Go to your Railway dashboard",
        step2: "Open the database console or connect via psql",
        step3: "Execute the SQL from migrations/ai-chat-schema.sql",
        command: "psql $DATABASE_URL -f migrations/ai-chat-schema.sql"
      },
      migrationPreview: migrationSQL.split('\n').slice(0, 20),
      tablesNeeded: {
        conversations: !conversationsExist,
        messages: !messagesExist
      }
    });
    
  } catch (error: unknown) {
    logger.error("[MIGRATION] Error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        message: "Migration check failed"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check current table status
    const { data: conversationsCheck, error: convError } = await supabase
      .from('ai_chat_conversations')
      .select('*')
      .limit(1);
    
    const { data: messagesCheck, error: msgError } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .limit(1);
    
    const conversationsExist = !convError || convError.code !== 'PGRST116';
    const messagesExist = !msgError || msgError.code !== 'PGRST116';
    
    return NextResponse.json({
      status: "ok",
      tables: {
        ai_chat_conversations: conversationsExist,
        ai_chat_messages: messagesExist,
        migrationNeeded: !conversationsExist || !messagesExist
      },
      errors: {
        conversations: convError?.message,
        messages: msgError?.message
      }
    });
    
  } catch (error: unknown) {
    logger.error("[MIGRATION] Error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { 
        status: "error", 
        error: error.message 
      },
      { status: 500 }
    );
  }
}
