// AI Chat API - Direct OpenAI Implementation
// Streams responses with function calling (most reliable approach)

import OpenAI from "openai";
import { createClient } from "@/lib/supabase";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import type { MenuSummary, AnalyticsSummary } from "@/types/ai-assistant";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, venueId } = await req.json();

    // Auth check
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get context
    const context = await getAssistantContext(venueId, user.id, "owner");
    const summaries = await getAllSummaries(venueId, context.features);

    // Build system message
    const systemMessage = buildSystemMessage(
      context,
      summaries as {
        menu?: MenuSummary;
        analytics?: AnalyticsSummary;
      }
    );

    // Define tools
    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "navigate",
          description: "Navigate to a different page in the application",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "string",
                enum: [
                  "dashboard",
                  "menu",
                  "inventory",
                  "orders",
                  "live-orders",
                  "kds",
                  "qr-codes",
                  "analytics",
                  "settings",
                  "staff",
                  "tables",
                  "feedback",
                ],
                description: "The page to navigate to",
              },
            },
            required: ["page"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_analytics",
          description: "Get analytics and insights about orders, revenue, and performance",
          parameters: {
            type: "object",
            properties: {
              metric: {
                type: "string",
                enum: ["revenue", "orders", "top_items", "peak_hours"],
              },
              timeRange: {
                type: "string",
                enum: ["today", "week", "month"],
              },
            },
            required: ["metric", "timeRange"],
          },
        },
      },
    ];

    // Call OpenAI with streaming
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemMessage }, ...messages],
      tools,
      tool_choice: "auto",
      stream: true,
    });

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              // Send text content
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: delta.content })}\n\n`
                )
              );
            }

            if (delta?.tool_calls) {
              // Send tool call
              for (const toolCall of delta.tool_calls) {
                if (toolCall.function?.name) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_call",
                        toolName: toolCall.function.name,
                        args: toolCall.function.arguments
                          ? JSON.parse(toolCall.function.arguments)
                          : {},
                      })}\n\n`
                    )
                  );

                  // Execute tool
                  const result = await executeToolCall(
                    toolCall.function.name,
                    toolCall.function.arguments || "{}",
                    venueId,
                    user.id
                  );
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_result",
                        toolName: toolCall.function.name,
                        result,
                      })}\n\n`
                    )
                  );
                }
              }
            }

            if (chunk.choices[0]?.finish_reason === "stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            }
          }
        } catch (error) {
          console.error("[AI CHAT] Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[AI CHAT] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to process chat" },
      { status: 500 }
    );
  }
}

async function executeToolCall(toolName: string, args: string, venueId: string, userId: string) {
  const parsedArgs = args ? JSON.parse(args) : {};

  if (toolName === "navigate") {
    const { page } = parsedArgs;
    const routeMap: Record<string, string> = {
      dashboard: `/dashboard/${venueId}`,
      menu: `/dashboard/${venueId}/menu-management`,
      inventory: `/dashboard/${venueId}/inventory`,
      orders: `/dashboard/${venueId}/orders`,
      "live-orders": `/dashboard/${venueId}/live-orders`,
      kds: `/dashboard/${venueId}/kds`,
      "qr-codes": `/dashboard/${venueId}/qr-codes`,
      analytics: `/dashboard/${venueId}/analytics`,
      settings: `/dashboard/${venueId}/settings`,
      staff: `/dashboard/${venueId}/staff`,
      tables: `/dashboard/${venueId}/tables`,
      feedback: `/dashboard/${venueId}/feedback`,
    };

    return {
      success: true,
      route: routeMap[page],
      message: `Navigating to ${page}`,
    };
  }

  if (toolName === "get_analytics") {
    const { metric, timeRange } = parsedArgs;
    return await executeTool(
      "analytics.get_stats",
      { metric, timeRange, groupBy: null, itemId: null, itemName: null },
      venueId,
      userId,
      false
    );
  }

  return { success: false, error: "Unknown tool" };
}

function buildSystemMessage(
  context: Awaited<ReturnType<typeof getAssistantContext>>,
  summaries: {
    menu?: MenuSummary;
    analytics?: AnalyticsSummary;
  }
): string {
  const menuInfo = summaries.menu
    ? `\n\nMENU: ${summaries.menu.totalItems} items in ${summaries.menu.categories.length} categories`
    : "";

  const analyticsInfo = summaries.analytics
    ? `\n\nTODAY: $${summaries.analytics.today.revenue} revenue, ${summaries.analytics.today.orders} orders`
    : "";

  return `You are an AI assistant for Servio restaurant management.

CONTEXT:
- Venue: ${context.venueId}
- Role: ${context.userRole}
${menuInfo}${analyticsInfo}

TOOLS AVAILABLE:
- navigate(page): Navigate to pages (feedback, analytics, menu, etc.)
- get_analytics(metric, timeRange): Get business insights

INSTRUCTIONS:
- Be friendly and conversational
- For greetings, just respond naturally
- When asked to navigate, use the navigate tool
- When asked about stats, use get_analytics
- Keep responses concise`;
}
