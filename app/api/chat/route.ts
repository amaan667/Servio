// AI Chat API - Vercel AI SDK Implementation
// Streams responses with tool calling support

import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
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
    const systemMessage = buildSystemMessage(context, summaries);

    // Stream response with tools
    const result = await streamText({
      model: openai("gpt-4o-mini"),
      messages: [{ role: "system", content: systemMessage }, ...messages],
      tools: {
        navigate: tool({
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
          execute: async ({ page }: { page: string }) => {
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
        getAnalytics: tool({
          description: "Get analytics and insights about orders, revenue, and performance",
          parameters: z.object({
            metric: z.enum(["revenue", "orders", "top_items", "peak_hours"]),
            timeRange: z.enum(["today", "week", "month"]),
          }),
          execute: async ({ metric, timeRange }: { metric: string; timeRange: string }) => {
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
        translateMenu: tool({
          description: "Translate the entire menu to a target language",
          parameters: z.object({
            targetLanguage: z.enum(["es", "ar", "fr", "de", "it", "pt", "zh", "ja"]),
            includeDescriptions: z.boolean().default(true),
          }),
          execute: async ({
            targetLanguage,
            includeDescriptions,
          }: {
            targetLanguage: string;
            includeDescriptions: boolean;
          }) => {
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
        updatePrices: tool({
          description: "Update prices for menu items",
          parameters: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                newPrice: z.number(),
              })
            ),
          }),
          execute: async ({ items }: { items: Array<{ id: string; newPrice: number }> }) => {
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
        toggleAvailability: tool({
          description: "Toggle availability of menu items (make available or unavailable)",
          parameters: z.object({
            itemIds: z.array(z.string()),
            available: z.boolean(),
            reason: z.string().nullable().optional(),
          }),
          execute: async ({
            itemIds,
            available,
            reason,
          }: {
            itemIds: string[];
            available: boolean;
            reason?: string | null;
          }) => {
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
- Navigate to different pages
- Get analytics and insights
- Translate menus
- Update menu prices
- Toggle item availability
${menuInfo}${analyticsInfo}

PERSONALITY:
- Be friendly, helpful, and conversational
- For greetings, respond naturally without trying to use tools
- When asked to perform actions, use the appropriate tools
- Keep responses concise and actionable
- If you need more information, ask clarifying questions

Remember: You can use tools when needed, but don't force them. Natural conversation is important.`;
}
