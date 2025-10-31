// AI Chat API - Direct OpenAI Implementation
// Proper function calling with multi-turn conversation

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

    // First API call - let AI decide if it needs tools
    const initialResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemMessage }, ...messages],
      tools,
      tool_choice: "auto",
    });

    const responseMessage = initialResponse.choices[0].message;

    // If AI wants to use tools, execute them and get final response
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolResults = [];

      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type !== "function") continue;

        const result = await executeToolCall(
          toolCall.function.name,
          toolCall.function.arguments,
          venueId,
          user.id
        );

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool" as const,
          content: JSON.stringify(result),
        });
      }

      // Get final response with tool results
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          ...messages,
          responseMessage,
          ...toolResults,
        ],
        stream: true,
      });

      // Stream the final response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of finalResponse) {
              const delta = chunk.choices[0]?.delta;

              if (delta?.content) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "text",
                      content: delta.content,
                    })}\n\n`
                  )
                );
              }

              if (chunk.choices[0]?.finish_reason === "stop") {
                // Send navigation if it was a navigate tool
                const navTool = responseMessage.tool_calls?.find(
                  (tc) => tc.type === "function" && tc.function.name === "navigate"
                );
                if (navTool && navTool.type === "function") {
                  const args = JSON.parse(navTool.function.arguments);
                  const route = getNavigationRoute(args.page, venueId);
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "navigate",
                        route,
                      })}\n\n`
                    )
                  );
                }

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
    }

    // No tools needed - just stream the response
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemMessage }, ...messages],
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "text",
                    content: delta.content,
                  })}\n\n`
                )
              );
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

function getNavigationRoute(page: string, venueId: string): string {
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
  return routeMap[page] || `/dashboard/${venueId}`;
}

async function executeToolCall(toolName: string, args: string, venueId: string, userId: string) {
  const parsedArgs = JSON.parse(args || "{}");

  if (toolName === "navigate") {
    const { page } = parsedArgs;
    return {
      success: true,
      page,
      message: `Navigating to ${page}`,
    };
  }

  if (toolName === "get_analytics") {
    const { metric, timeRange } = parsedArgs;
    const result = await executeTool(
      "analytics.get_stats",
      { metric, timeRange, groupBy: null, itemId: null, itemName: null },
      venueId,
      userId,
      false
    );
    return result;
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
    ? `\n\nMENU: ${summaries.menu.totalItems} items, Top seller: ${summaries.menu.topSellers[0]?.name || "N/A"}`
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
- navigate(page): Navigate to pages
- get_analytics(metric, timeRange): Get business stats. Metrics: revenue, orders, top_items, peak_hours. TimeRange: today, week, month

INSTRUCTIONS:
- Be friendly and conversational
- For greetings, just respond naturally
- When users ask about sales/analytics, use get_analytics tool and interpret the results in a friendly way
- When asked to navigate, use navigate tool
- Always interpret tool results - don't just say you executed them, explain what the data means`;
}
