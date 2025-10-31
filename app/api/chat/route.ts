// AI Chat API - Vercel AI SDK Implementation with Tools
// Streams responses with tool calling support

import { openai } from "@ai-sdk/openai";
import { streamText, tool as aiTool, CoreMessage } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
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
      model: openai("gpt-4o-mini"),
      messages: [
        { role: "system", content: systemMessage } as CoreMessage,
        ...(messages as CoreMessage[]),
      ],
      tools: {
        navigate: aiTool({
          description: "Navigate to a different page in the application",
          parameters: z.object({
            page: z
              .enum([
                "dashboard",
                "menu",
                "inventory",
                "orders",
                "live-orders",
                "kds",
                "kitchen-display",
                "qr-codes",
                "analytics",
                "settings",
                "staff",
                "tables",
                "feedback",
              ])
              .describe("The page to navigate to"),
          }),
          // @ts-expect-error - AI SDK tool types are complex
          execute: async ({ page }) => {
            const routeMap: Record<string, string> = {
              dashboard: `/dashboard/${venueId}`,
              menu: `/dashboard/${venueId}/menu-management`,
              inventory: `/dashboard/${venueId}/inventory`,
              orders: `/dashboard/${venueId}/orders`,
              "live-orders": `/dashboard/${venueId}/live-orders`,
              kds: `/dashboard/${venueId}/kds`,
              "kitchen-display": `/dashboard/${venueId}/kds`,
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
          },
        }),
        getAnalytics: aiTool({
          description: "Get analytics and insights about orders, revenue, and performance",
          parameters: z.object({
            metric: z.enum(["revenue", "orders", "top_items", "peak_hours"]),
            timeRange: z.enum(["today", "week", "month"]),
          }),
          // @ts-expect-error - AI SDK tool types
          execute: async ({ metric, timeRange }) => {
            const result = await executeTool(
              "analytics.get_stats",
              { metric, timeRange, groupBy: null, itemId: null, itemName: null },
              venueId,
              user.id,
              false
            );
            return result;
          },
        }),
        translateMenu: aiTool({
          description: "Translate the entire menu to a target language",
          parameters: z.object({
            targetLanguage: z.enum(["es", "ar", "fr", "de", "it", "pt", "zh", "ja"]),
            includeDescriptions: z.boolean().default(true),
          }),
          // @ts-expect-error - AI SDK tool types
          execute: async ({ targetLanguage, includeDescriptions }) => {
            const result = await executeTool(
              "menu.translate",
              { targetLanguage, includeDescriptions },
              venueId,
              user.id,
              false
            );
            return result;
          },
        }),
        updatePrices: aiTool({
          description: "Update prices for menu items",
          parameters: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                newPrice: z.number(),
              })
            ),
          }),
          // @ts-expect-error - AI SDK tool types
          execute: async ({ items }) => {
            const result = await executeTool(
              "menu.update_prices",
              { items, preview: false },
              venueId,
              user.id,
              false
            );
            return result;
          },
        }),
        toggleAvailability: aiTool({
          description: "Toggle availability of menu items",
          parameters: z.object({
            itemIds: z.array(z.string()),
            available: z.boolean(),
            reason: z.string().nullable().optional(),
          }),
          // @ts-expect-error - AI SDK tool types
          execute: async ({ itemIds, available, reason }) => {
            const result = await executeTool(
              "menu.toggle_availability",
              { itemIds, available, reason: reason || null },
              venueId,
              user.id,
              false
            );
            return result;
          },
        }),
      },
    });

    return result.toTextStreamResponse();
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

CAPABILITIES:
You have access to the following tools:
- navigate: Navigate to different pages (feedback, analytics, menu, orders, etc.)
- getAnalytics: Get business insights and statistics
- translateMenu: Translate menu to different languages
- updatePrices: Update menu item prices
- toggleAvailability: Make items available or unavailable
${menuInfo}${analyticsInfo}

INSTRUCTIONS:
- Be friendly and conversational
- For greetings, respond naturally without calling tools
- When asked to navigate, use the navigate tool
- When asked about analytics/stats, use getAnalytics
- When asked to translate, use translateMenu
- For menu updates, use the appropriate tools
- Keep responses concise and actionable

Remember: You can execute actions for the user automatically using tools!`;
}
