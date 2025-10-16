// API endpoint to migrate AI conversations from old to new system
// and generate AI-powered titles for existing conversations

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateConversationTitle } from "@/lib/ai/openai-service";

export async function POST(request: NextRequest) {
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

    console.log("[AI MIGRATION] Starting AI conversations migration...");

    // Step 1: Check if old conversations exist
    const { data: oldConversations, error: oldError } = await adminSupabase
      .from("ai_conversations")
      .select("id, title, created_at")
      .limit(5);

    if (oldError && oldError.code !== 'PGRST116') {
      console.error("[AI MIGRATION] Error checking old conversations:", oldError);
      return NextResponse.json(
        { error: "Failed to check existing conversations", details: oldError.message },
        { status: 500 }
      );
    }

    // Step 2: Check if new conversations already exist
    const { data: newConversations, error: newError } = await adminSupabase
      .from("ai_chat_conversations")
      .select("id, title, created_at")
      .limit(5);

    if (newError && newError.code !== 'PGRST116') {
      console.error("[AI MIGRATION] Error checking new conversations:", newError);
      return NextResponse.json(
        { error: "Failed to check new conversations", details: newError.message },
        { status: 500 }
      );
    }

    const oldCount = oldConversations?.length || 0;
    const newCount = newConversations?.length || 0;

    console.log("[AI MIGRATION] Old conversations:", oldCount, "New conversations:", newCount);

    // Step 3: If new conversations exist, just generate AI titles for existing ones
    if (newCount > 0) {
      console.log("[AI MIGRATION] New conversations exist, generating AI titles...");
      
      // Get conversations that need AI title generation
      const { data: conversationsNeedingTitles, error: titlesError } = await adminSupabase
        .rpc('get_conversations_needing_ai_titles');

      if (titlesError) {
        console.error("[AI MIGRATION] Error getting conversations needing titles:", titlesError);
        return NextResponse.json(
          { error: "Failed to get conversations needing titles", details: titlesError.message },
          { status: 500 }
        );
      }

      console.log("[AI MIGRATION] Found", conversationsNeedingTitles?.length || 0, "conversations needing AI titles");

      // Generate AI titles for each conversation
      let updatedCount = 0;
      for (const conv of conversationsNeedingTitles || []) {
        try {
          if (conv.first_user_message && conv.first_user_message.trim()) {
            const aiTitle = await generateConversationTitle(conv.first_user_message);
            
            const { error: updateError } = await adminSupabase
              .rpc('update_conversation_ai_title', {
                conv_id: conv.conversation_id,
                new_title: aiTitle
              });

            if (updateError) {
              console.error("[AI MIGRATION] Error updating title for conversation", conv.conversation_id, ":", updateError);
            } else {
              console.log("[AI MIGRATION] Updated conversation", conv.conversation_id, "title to:", aiTitle);
              updatedCount++;
            }
          }
        } catch (error) {
          console.error("[AI MIGRATION] Error generating title for conversation", conv.conversation_id, ":", error);
        }
      }

      return NextResponse.json({
        success: true,
        message: `AI title generation completed`,
        details: {
          conversationsNeedingTitles: conversationsNeedingTitles?.length || 0,
          titlesUpdated: updatedCount,
          migrationType: "ai_title_generation"
        }
      });
    }

    // Step 4: If no new conversations exist but old ones do, run full migration
    if (oldCount > 0 && newCount === 0) {
      console.log("[AI MIGRATION] Running full migration from old to new system...");
      
      // Get all old conversations
      const { data: allOldConversations, error: allOldError } = await adminSupabase
        .from("ai_conversations")
        .select("*")
        .order("created_at", { ascending: true });

      if (allOldError) {
        console.error("[AI MIGRATION] Error getting all old conversations:", allOldError);
        return NextResponse.json(
          { error: "Failed to get old conversations", details: allOldError.message },
          { status: 500 }
        );
      }

      console.log("[AI MIGRATION] Found", allOldConversations?.length || 0, "old conversations to migrate");

      // Migrate conversations one by one
      let migratedCount = 0;
      for (const oldConv of allOldConversations || []) {
        try {
          // Create new conversation
          const { data: newConv, error: createError } = await adminSupabase
            .from("ai_chat_conversations")
            .insert({
              id: oldConv.id, // Keep same ID
              venue_id: oldConv.venue_id,
              user_id: oldConv.created_by,
              title: oldConv.title === 'New Conversation' ? 'Chat Conversation' : oldConv.title,
              created_at: oldConv.created_at,
              updated_at: oldConv.updated_at,
              migration_status: 'migrated'
            })
            .select("*")
            .single();

          if (createError) {
            console.error("[AI MIGRATION] Error creating conversation", oldConv.id, ":", createError);
            continue;
          }

          // Get messages for this conversation
          const { data: messages, error: messagesError } = await adminSupabase
            .from("ai_messages")
            .select("*")
            .eq("conversation_id", oldConv.id)
            .order("created_at", { ascending: true });

          if (messagesError) {
            console.error("[AI MIGRATION] Error getting messages for conversation", oldConv.id, ":", messagesError);
            continue;
          }

          // Migrate messages
          for (const message of messages || []) {
            const { error: msgError } = await adminSupabase
              .from("ai_chat_messages")
              .insert({
                id: message.id, // Keep same ID
                conversation_id: message.conversation_id,
                role: message.author_role === 'tool' ? 'assistant' : message.author_role,
                content: message.text || (message.content?.text) || '',
                tool_name: message.tool_name,
                created_at: message.created_at
              });

            if (msgError) {
              console.error("[AI MIGRATION] Error migrating message", message.id, ":", msgError);
            }
          }

          // Generate AI title for this conversation
          const firstUserMessage = messages?.find(m => m.author_role === 'user')?.text || 
                                   messages?.find(m => m.author_role === 'user')?.content?.text;
          
          if (firstUserMessage && firstUserMessage.trim()) {
            try {
              const aiTitle = await generateConversationTitle(firstUserMessage);
              await adminSupabase
                .from("ai_chat_conversations")
                .update({ title: aiTitle, updated_at: new Date().toISOString() })
                .eq("id", oldConv.id);
              
              console.log("[AI MIGRATION] Generated AI title for conversation", oldConv.id, ":", aiTitle);
            } catch (titleError) {
              console.error("[AI MIGRATION] Error generating AI title for conversation", oldConv.id, ":", titleError);
            }
          }

          migratedCount++;
          console.log("[AI MIGRATION] Migrated conversation", oldConv.id, "with", messages?.length || 0, "messages");

        } catch (error) {
          console.error("[AI MIGRATION] Error migrating conversation", oldConv.id, ":", error);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Migration completed successfully`,
        details: {
          oldConversations: allOldConversations?.length || 0,
          migratedConversations: migratedCount,
          migrationType: "full_migration"
        }
      });
    }

    // Step 5: If no conversations exist at all
    return NextResponse.json({
      success: true,
      message: "No existing conversations found to migrate",
      details: {
        oldConversations: 0,
        newConversations: 0,
        migrationType: "no_migration_needed"
      }
    });

  } catch (error: any) {
    console.error("[AI MIGRATION] Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();
    
    // Get migration status
    const { data: migrationStatus, error } = await adminSupabase
      .from("migration_status")
      .select("*");

    if (error) {
      console.error("[AI MIGRATION] Error getting migration status:", error);
      return NextResponse.json(
        { error: "Failed to get migration status", details: error.message },
        { status: 500 }
      );
    }

    // Get conversations needing AI titles
    const { data: conversationsNeedingTitles } = await adminSupabase
      .rpc('get_conversations_needing_ai_titles');

    return NextResponse.json({
      success: true,
      migrationStatus: migrationStatus || [],
      conversationsNeedingAiTitles: conversationsNeedingTitles?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[AI MIGRATION] Status check error:", error);
    return NextResponse.json(
      { error: "Failed to check migration status", details: error.message },
      { status: 500 }
    );
  }
}
