// Production AI Messages API
// Handles message loading and creation with proper tool calling support

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { z } from "zod";
import { planAssistantAction, generateConversationTitle } from "@/lib/ai/assistant-llm";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import { logger } from "@/lib/logger";

export const maxDuration = 60; // Increased for analytics computation

const CreateMessageSchema = z.object({
  venueId: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  text: z.string().min(1),
  currentPage: z.string().optional(),
});

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
    const conversationId = searchParams.get("conversationId");
    const limit = parseInt(searchParams.get("limit") || "200");

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    // Verify user has access to this conversation
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select(
        `
        *,
        venues!inner(owner_user_id)
      `
      )
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.venues.owner_user_id !== user.id) {
      return NextResponse.json({ error: "Access denied to this conversation" }, { status: 403 });
    }

    // Get messages for this conversation
    const { data: messages, error } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      logger.error("[AI CHAT] Failed to fetch messages:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    // Transform messages to match frontend expectations
    const transformedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      venueId: msg.venue_id,
      authorRole: msg.author_role,
      text: msg.text,
      content: msg.content,
      callId: msg.call_id,
      toolName: msg.tool_name,
      createdAt: msg.created_at,
    }));

    return NextResponse.json({
      messages: transformedMessages,
    });
  } catch (_error) {
    logger.error("[AI CHAT] Messages error:", {
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
    const { venueId, conversationId, text, currentPage } = CreateMessageSchema.parse(body);

    // Verify user has access to venue (role-based first, then owner fallback)
    let roleName: string | null = null;
    try {
      const { data: roleRow, error: roleErr } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("venue_id", venueId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!roleErr && roleRow?.role) roleName = roleRow.role;
    } catch {
      // ignore, fallback to owner
    }

    if (!roleName) {
      const { data: venue } = await supabase
        .from("venues")
        .select("owner_user_id")
        .eq("venue_id", venueId)
        .single();
      if (!venue || venue.owner_user_id !== user.id) {
        return NextResponse.json({ error: "Access denied to this venue" }, { status: 403 });
      }
      roleName = "owner";
    }
    logger.debug("[AI MESSAGES] Access granted with role:", {
      data: { userId: user.id, extra: venueId, role: roleName },
    });

    let currentConversationId = conversationId;

    // Create conversation if none exists
    if (!currentConversationId) {
      const title = text.substring(0, 60); // Provisional title from first message

      const { data: newConversation, error: convError } = await supabase
        .from("ai_conversations")
        .insert({
          venue_id: venueId,
          created_by: user.id,
          title,
        })
        .select("*")
        .single();

      if (convError) {
        logger.error("[AI CHAT] Failed to create conversation:", {
          error: convError.message || "Unknown error",
        });
        return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
      }

      currentConversationId = newConversation.id;
    } else {
      // Verify access to existing conversation
      const { data: existingConversation } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("id", currentConversationId)
        .single();

      if (!existingConversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    }

    // Save user message
    const { data: userMessage, error: msgError } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: currentConversationId,
        venue_id: venueId,
        author_role: "user",
        text: text,
        content: { text },
      })
      .select("*")
      .single();

    if (msgError) {
      logger.error("[AI CHAT] Failed to save user message:", {
        error: msgError.message || "Unknown error",
      });
      return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
    }

    // Call AI service with advanced planning system
    try {
      // Get context and data summaries
      const context = await getAssistantContext(venueId, user.id);
      const summaries = await getAllSummaries(venueId, context.features);

      // Plan the action
      const plan = await planAssistantAction(text, context, summaries);

      let assistantResponse = "";
      const toolResults: unknown[] = [];

      // Handle direct answer (no tools needed)
      if (plan.directAnswer) {
        assistantResponse = plan.directAnswer;
      }
      // Execute tools if present
      else if (plan.tools && plan.tools.length > 0) {
        for (const tool of plan.tools) {
          const result = await executeTool(
            tool.name,
            tool.params,
            venueId,
            user.id,
            false // execute, not preview
          );

          toolResults.push({
            tool: tool.name,
            result,
          });

          // Handle navigation
          if (tool.name === "navigation.go_to_page" && "success" in result && result.success) {
            const message = "message" in result ? result.message : undefined;
            assistantResponse =
              (message as string | undefined) || `Navigating to ${tool.params.page}`;
          }
        }

        // Generate final response if not navigation
        if (!assistantResponse) {
          assistantResponse = plan.reasoning || "Actions completed successfully";
        }
      }
      // Fallback for unclear requests
      else {
        assistantResponse =
          plan.reasoning || "I'm not sure how to help with that. Could you clarify?";
      }

      // Save assistant response
      await supabase.from("ai_messages").insert({
        conversation_id: currentConversationId!,
        venue_id: venueId,
        author_role: "assistant",
        text: assistantResponse,
        content: { text: assistantResponse, toolResults },
      });

      const aiResult = { response: assistantResponse, toolResults };

      // Get the latest messages including the AI response
      const { data: allMessages } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", currentConversationId!)
        .order("created_at", { ascending: true });

      // Generate conversation title if this is the first exchange
      const messageCount = allMessages?.filter((m) => m.author_role === "user").length || 0;
      if (messageCount === 1) {
        const title = await generateConversationTitle(text);
        await supabase.from("ai_conversations").update({ title }).eq("id", currentConversationId!);
      }

      // Transform all messages
      const transformedMessages = (allMessages || []).map((msg) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        venueId: msg.venue_id,
        authorRole: msg.author_role,
        text: msg.text,
        content: msg.content,
        callId: msg.call_id,
        toolName: msg.tool_name,
        createdAt: msg.created_at,
      }));

      return NextResponse.json({
        conversationId: currentConversationId!,
        messages: transformedMessages,
        toolResults: aiResult.toolResults || [],
      });
    } catch (aiError: unknown) {
      logger.error("[AI CHAT] AI service error:", {
        error: aiError instanceof Error ? aiError.message : "Unknown error",
      });

      const errorMessage =
        aiError instanceof Error ? aiError.message : "An unexpected error occurred";

      // Save error message
      const { data: errorMsg } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: currentConversationId,
          venue_id: venueId,
          author_role: "assistant",
          text: `I encountered an error: ${errorMessage}`,
          content: { text: `I encountered an error: ${errorMessage}` },
        })
        .select("*")
        .single();

      const transformedUserMessage = {
        id: userMessage.id,
        conversationId: userMessage.conversation_id,
        venueId: userMessage.venue_id,
        authorRole: userMessage.author_role,
        text: userMessage.text,
        content: userMessage.content,
        callId: userMessage.call_id,
        toolName: userMessage.tool_name,
        createdAt: userMessage.created_at,
      };

      const transformedErrorMessage = errorMsg
        ? {
            id: errorMsg.id,
            conversationId: errorMsg.conversation_id,
            venueId: errorMsg.venue_id,
            authorRole: errorMsg.author_role,
            text: errorMsg.text,
            content: errorMsg.content,
            callId: errorMsg.call_id,
            toolName: errorMsg.tool_name,
            createdAt: errorMsg.created_at,
          }
        : {
            id: "error",
            conversationId: currentConversationId!,
            venueId: venueId,
            authorRole: "assistant" as const,
            text: `I encountered an error: ${errorMessage}`,
            content: { text: `I encountered an error: ${errorMessage}` },
            createdAt: new Date().toISOString(),
          };

      return NextResponse.json({
        conversationId: currentConversationId!,
        messages: [transformedUserMessage, transformedErrorMessage],
        error: errorMessage,
      });
    }
  } catch (_error) {
    logger.error("[AI CHAT] Create message error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });

    interface ZodError extends Error {
      errors: unknown[];
    }
    const zodError = _error as ZodError;
    if (zodError?.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: zodError?.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}
