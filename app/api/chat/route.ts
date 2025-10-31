// AI Chat API - Vercel AI SDK v4 Implementation with Tools
// Streams responses with tool calling support

import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import type { MenuSummary, AnalyticsSummary } from "@/types/ai-assistant";

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

    // Build system message with context
    const systemMessage = buildSystemMessage(
      context,
      summaries as {
        menu?: MenuSummary;
        analytics?: AnalyticsSummary;
      }
    );

    // Stream response with tools
    const result = await streamText({
      model: openai.chat("gpt-4o-mini") as any,
      system: systemMessage,
      messages,
      tools: {
        navigate: tool({
          description: "Navigate to a different page in the Servio application",
          parameters: z.object({
            page: z.enum([
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
            ]),
          }),
        }),
        getAnalytics: tool({
          description: "Get analytics and insights about orders, revenue, and performance",
          parameters: z.object({
            metric: z.enum(["revenue", "orders", "top_items", "peak_hours"]),
            timeRange: z.enum(["today", "week", "month"]),
          }),
        }),
        translateMenu: tool({
          description: "Translate the entire menu to a target language",
          parameters: z.object({
            targetLanguage: z.enum(["es", "ar", "fr", "de", "it", "pt", "zh", "ja"]),
            includeDescriptions: z.boolean().default(true),
          }),
        }),
      },
      toolChoice: "auto",
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[AI CHAT] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to process chat" },
      { status: 500 }
    );
  }
}

function buildSystemMessage(
  context: Awaited<ReturnType<typeof getAssistantContext>>,
  summaries: {
    menu?: MenuSummary;
    analytics?: AnalyticsSummary;
  }
): string {
  const menuInfo = summaries.menu
    ? `\n\nMENU OVERVIEW:\n- Total items: ${summaries.menu.totalItems}\n- Categories: ${summaries.menu.categories.map((c: { name: string }) => c.name).join(", ")}\n- Top sellers: ${summaries.menu.topSellers.map((i: { name: string; price: number }) => `${i.name} ($${i.price})`).join(", ")}`
    : "";

  const analyticsInfo = summaries.analytics
    ? `\n\nTODAY'S STATS:\n- Revenue: $${summaries.analytics.today.revenue}\n- Orders: ${summaries.analytics.today.orders}\n- Avg order: $${summaries.analytics.today.avgOrderValue}`
    : "";

  return `You are an AI assistant for Servio, a restaurant management platform.

CONTEXT:
- Venue: ${context.venueId}
- User role: ${context.userRole}
- Timezone: ${context.timezone}

AVAILABLE TOOLS:
You have access to several tools to help users:
1. **navigate** - Navigate to different pages (feedback, menu, analytics, etc.)
2. **getAnalytics** - Retrieve analytics data  
3. **translateMenu** - Translate the menu
${menuInfo}${analyticsInfo}

INSTRUCTIONS:
- For greetings ("hi", "hello"), respond warmly WITHOUT using tools
- When users ask to go somewhere (e.g., "take me to feedback"), use the **navigate** tool
- When users ask about sales/revenue/data, use the **getAnalytics** tool
- When users want to translate, use the **translateMenu** tool
- Be conversational and helpful
- Use tools when appropriate, but chat naturally when tools aren't needed

Remember: Use tools for actions, chat naturally for conversation.`;
}
