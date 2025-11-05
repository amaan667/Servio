// AI Chat API - Intelligent Business Assistant
// Full context with menu, hours, plan, and smart multi-step responses

import OpenAI from "openai";
import { createClient } from "@/lib/supabase";
import { getAssistantContext, getAllSummaries } from "@/lib/ai/context-builders";
import { executeTool } from "@/lib/ai/tool-executors";
import type { MenuSummary, AnalyticsSummary } from "@/types/ai-assistant";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Increased for analytics computation

export async function POST(req: Request) {
  try {
    const { messages, venueId, currentPage } = await req.json();

    // Auth check
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get FULL venue context
    const venueDetails = await getFullVenueContext(venueId, user.id);
    const context = await getAssistantContext(venueId, user.id, "owner");
    const summaries = await getAllSummaries(venueId, context.features);

    // Build intelligent system message
    const systemMessage = buildIntelligentSystemMessage(
      venueDetails,
      venueDetails.userRole,
      summaries as {
        menu?: MenuSummary;
        analytics?: AnalyticsSummary;
      },
      currentPage
    );

    // Define tools with comprehensive capabilities
    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "navigate",
          description:
            "Navigate to a page. ALWAYS use when user asks to go somewhere or generate QR codes.",
          parameters: {
            type: "object",
            properties: {
              page: {
                type: "string",
                enum: [
                  "dashboard",
                  "menu",
                  "menu-management",
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
              },
              tableNumber: {
                type: "string",
                description: "For QR codes page, specify table number (e.g., '5', 'Table 5')",
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
          description:
            "Get real business analytics and stats. Use 'top_items' for best-selling items.",
          parameters: {
            type: "object",
            properties: {
              metric: {
                type: "string",
                enum: ["revenue", "orders", "top_items", "peak_hours"],
              },
              timeRange: {
                type: "string",
                enum: ["today", "week", "month", "hour"],
              },
            },
            required: ["metric", "timeRange"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "add_menu_item",
          description:
            "Add a new item to the menu. If user doesn't provide all details, ask for them conversationally.",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The name of the menu item",
              },
              category: {
                type: "string",
                description: "Category like 'Coffee', 'Food', 'Pastries', etc.",
              },
              price: {
                type: "number",
                description: "Price in the venue's currency",
              },
              description: {
                type: "string",
                description: "Optional description of the item",
              },
            },
            required: ["name", "category", "price"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "delete_menu_item",
          description: "Delete/remove a menu item. If multiple items match, ask for clarification.",
          parameters: {
            type: "object",
            properties: {
              itemName: {
                type: "string",
                description: "The name of the menu item to delete",
              },
              itemId: {
                type: "string",
                description: "Optional: exact item ID if known",
              },
            },
            required: ["itemName"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "translate_menu",
          description:
            "Translate all menu items to a different language. Supports English, Spanish, French, German, Italian, Portuguese, Arabic, Chinese, Japanese.",
          parameters: {
            type: "object",
            properties: {
              targetLanguage: {
                type: "string",
                enum: ["en", "es", "fr", "de", "it", "pt", "ar", "zh", "ja"],
                description: "Target language code (en=English, es=Spanish, fr=French, etc.)",
              },
              includeDescriptions: {
                type: "boolean",
                description: "Whether to translate descriptions too (default: true)",
              },
            },
            required: ["targetLanguage"],
          },
        },
      },
      // ANALYTICS & INTELLIGENCE TOOLS
      {
        type: "function",
        function: {
          name: "analyze_menu_performance",
          description:
            "Analyze which menu items are performing well and which are underperforming. Shows top sellers and items that should be removed.",
          parameters: {
            type: "object",
            properties: {
              timeRange: {
                type: "string",
                enum: ["week", "month", "quarter"],
                description: "Time period to analyze",
              },
            },
            required: ["timeRange"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "optimize_prices",
          description:
            "Suggest optimal pricing for menu items based on demand and sales data. Shows which items can support price increases and which need discounts.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "forecast_revenue",
          description:
            "Predict future revenue based on historical trends. Provides next week and next month forecasts with confidence levels.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "calculate_margins",
          description:
            "Calculate profit margins for each menu item. Shows which items are most profitable and should be promoted.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      // OPERATIONAL TOOLS
      {
        type: "function",
        function: {
          name: "analyze_kitchen",
          description:
            "Identify kitchen bottlenecks and slow stations. Shows average prep times and suggests improvements.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "optimize_staff",
          description:
            "Suggest optimal staff scheduling based on demand patterns. Identifies peak periods that need more staff.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "reduce_waste",
          description:
            "Analyze waste patterns and identify items with low sales that may be wasted. Suggests which items to prep less or remove.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "improve_turnover",
          description:
            "Analyze table turnover times and identify slow tables or service bottlenecks.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      // CUSTOMER INSIGHTS
      {
        type: "function",
        function: {
          name: "analyze_feedback",
          description:
            "Analyze customer feedback for sentiment, common themes, and improvement areas. Shows what customers love and what needs work.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "find_popular_combos",
          description:
            "Identify popular item combinations that customers order together. Suggests combo deals for upselling.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "analyze_loyalty",
          description:
            "Track repeat customers and loyalty metrics. Shows top customers and repeat purchase rates.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "forecast_demand",
          description:
            "Forecast demand by hour and day of week. Helps with inventory planning and staffing.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      // INVENTORY & COST
      {
        type: "function",
        function: {
          name: "predict_inventory",
          description:
            "Predict inventory needs and when items will run out. Suggests reorder quantities.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "analyze_costs",
          description:
            "Analyze food costs and profit margins per dish. Shows which items have the best margins.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      // MARKETING & GROWTH
      {
        type: "function",
        function: {
          name: "suggest_promotions",
          description:
            "Suggest targeted promotions to boost revenue during slow periods or increase average order value.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "seasonal_ideas",
          description: "Get seasonal menu item suggestions based on current season and trends.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      // AUTOMATION
      {
        type: "function",
        function: {
          name: "bulk_price_update",
          description:
            "Update prices for multiple items at once. Can increase/decrease by percentage or fixed amount, optionally filtered by category.",
          parameters: {
            type: "object",
            properties: {
              operation: {
                type: "string",
                enum: ["increase", "decrease"],
                description: "Whether to increase or decrease prices",
              },
              amount: {
                type: "number",
                description: "Amount to change (use with operation)",
              },
              percentage: {
                type: "number",
                description: "Percentage to change (alternative to amount)",
              },
              category: {
                type: "string",
                description: "Optional: only update items in this category",
              },
            },
            required: ["operation"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "generate_report",
          description: "Generate automated performance report for weekly or monthly periods.",
          parameters: {
            type: "object",
            properties: {
              period: {
                type: "string",
                enum: ["weekly", "monthly"],
                description: "Report time period",
              },
            },
            required: ["period"],
          },
        },
      },
    ];

    // First API call
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
      let navigationInfo: { route: string; tableNumber?: string } | null = null;

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

        // Track navigation for later
        if (toolCall.function.name === "navigate") {
          const args = JSON.parse(toolCall.function.arguments);
          navigationInfo = {
            route: getNavigationRoute(args.page, venueId, args.tableNumber),
            tableNumber: args.tableNumber,
          };
        }

        // Auto-navigate after menu item creation
        if (
          toolCall.function.name === "add_menu_item" &&
          (result as Record<string, unknown>).shouldNavigate
        ) {
          const navigateTo = (result as Record<string, unknown>).navigateTo;
          const navigateToStr = typeof navigateTo === "string" ? navigateTo : "menu";
          navigationInfo = {
            route: getNavigationRoute(navigateToStr, venueId),
          };
        }
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
                // Send navigation AFTER AI explains
                if (navigationInfo) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "navigate",
                        route: navigationInfo.route,
                        tableNumber: navigationInfo.tableNumber,
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

    // No tools needed - just stream
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

async function getFullVenueContext(venueId: string, userId: string) {
  const supabase = await createClient();

  // Get all venue details including owner and currency
  const { data: venue } = await supabase
    .from("venues")
    .select("*, currency")
    .eq("venue_id", venueId)
    .single();

  // Get subscription tier from organizations table
  let subscriptionTier = "basic";
  if (venue?.owner_user_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("subscription_tier, subscription_status")
      .eq("owner_user_id", venue.owner_user_id)
      .maybeSingle();

    if (org?.subscription_status === "active" || org?.subscription_status === "trialing") {
      subscriptionTier = org.subscription_tier || "basic";
    }
  }

  // Get user's role
  let userRole = "staff";
  if (venue?.owner_user_id === userId) {
    userRole = "owner";
  } else {
    const { data: roleData } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venueId)
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role) {
      userRole = roleData.role;
    }
  }

  // Get menu items (all of them!)
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, price, category, description, is_available")
    .eq("venue_id", venueId)
    .eq("is_available", true)
    .order("name");

  return {
    name: venue?.venue_name || "your business",
    businessType: venue?.business_type || venue?.venue_type || "restaurant",
    serviceType: venue?.service_type || "table_service",
    subscriptionTier,
    operatingHours: venue?.operating_hours || null,
    address: venue?.address || null,
    phone: venue?.phone || null,
    timezone: venue?.timezone || "UTC",
    currency: venue?.currency || "GBP",
    menuItems: menuItems || [],
    userRole,
  };
}

function getNavigationRoute(page: string, venueId: string, tableNumber?: string): string {
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

  let route = routeMap[page] || `/dashboard/${venueId}`;

  // Add table parameter for QR codes
  if (page === "qr-codes" && tableNumber) {
    route += `?table=${encodeURIComponent(tableNumber)}`;
  }

  return route;
}

async function executeToolCall(toolName: string, args: string, venueId: string, userId: string) {
  const parsedArgs = JSON.parse(args || "{}");

  if (toolName === "navigate") {
    const { page, tableNumber } = parsedArgs;
    return {
      success: true,
      page,
      tableNumber: tableNumber || null,
      message: tableNumber
        ? `Navigating to ${page} for table ${tableNumber}`
        : `Navigating to ${page}`,
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

  if (toolName === "add_menu_item") {
    const { name, category, price, description } = parsedArgs;

    // Add item directly via Supabase
    const supabase = await createClient();
    const venueIdWithPrefix = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        venue_id: venueIdWithPrefix,
        name: name.trim(),
        description: description?.trim() || "",
        price: Number(price),
        category: category.trim(),
        is_available: true,
      })
      .select("id, name, price, category")
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to add item",
      };
    }

    // Revalidate the menu management page to show new item
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath(`/dashboard/${venueId}/menu-management`, "page");
    } catch (_revalidateError) {
      // Don't fail if revalidation fails
    }

    return {
      success: true,
      message: `Successfully added "${name}" to the menu under ${category} for $${price}`,
      item: data,
      shouldNavigate: true,
      navigateTo: "menu",
    };
  }

  if (toolName === "delete_menu_item") {
    const { itemName, itemId } = parsedArgs;
    const supabase = await createClient();
    const venueIdWithPrefix = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

    // Find item(s) matching the name or ID
    let query = supabase.from("menu_items").select("id, name").eq("venue_id", venueIdWithPrefix);

    if (itemId) {
      query = query.eq("id", itemId);
    } else {
      query = query.ilike("name", `%${itemName}%`);
    }

    const { data: matchingItems, error: searchError } = await query;

    if (searchError || !matchingItems || matchingItems.length === 0) {
      return {
        success: false,
        error: `No menu items found matching "${itemName}". Please check the item name and try again.`,
      };
    }

    if (matchingItems.length > 1 && !itemId) {
      return {
        success: false,
        error: `Multiple items found matching "${itemName}": ${matchingItems.map((i) => i.name).join(", ")}. Please be more specific.`,
        matchingItems: matchingItems,
      };
    }

    // Delete the item
    const itemToDelete = matchingItems[0];
    const { error: deleteError } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", itemToDelete.id);

    if (deleteError) {
      return {
        success: false,
        error: `Failed to delete item: ${deleteError.message}`,
      };
    }

    // Revalidate the menu management page to show item removed
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath(`/dashboard/${venueId}/menu-management`, "page");
    } catch (_revalidateError) {
      // Don't fail if revalidation fails
    }

    return {
      success: true,
      deletedItem: itemToDelete,
      message: `Successfully deleted "${itemToDelete.name}" from the menu.`,
    };
  }

  if (toolName === "translate_menu") {
    const { targetLanguage, includeDescriptions = true } = parsedArgs;

    // Use the translation executor from tool-executors
    const result = await executeTool(
      "menu.translate",
      {
        targetLanguage,
        includeDescriptions,
        categoryMapping: null,
      },
      venueId,
      userId,
      false // execute mode, not preview
    );

    return result;
  }

  // Import tool functions
  const analyticsTools = await import("@/lib/ai/tools/analytics-tools");
  const operationsTools = await import("@/lib/ai/tools/operations-tools");
  const customerTools = await import("@/lib/ai/tools/customer-tools");
  const inventoryMarketingTools = await import("@/lib/ai/tools/inventory-marketing-tools");

  // ANALYTICS TOOLS
  if (toolName === "analyze_menu_performance") {
    return await analyticsTools.analyzeMenuPerformance(venueId, parsedArgs.timeRange || "month");
  }

  if (toolName === "optimize_prices") {
    return await analyticsTools.suggestPriceOptimization(venueId);
  }

  if (toolName === "forecast_revenue") {
    return await analyticsTools.forecastRevenue(venueId);
  }

  if (toolName === "calculate_margins") {
    return await analyticsTools.calculateItemMargins(venueId);
  }

  // OPERATIONS TOOLS
  if (toolName === "analyze_kitchen") {
    return await operationsTools.analyzeKitchenBottlenecks(venueId);
  }

  if (toolName === "optimize_staff") {
    return await operationsTools.optimizeStaffSchedule(venueId);
  }

  if (toolName === "reduce_waste") {
    return await operationsTools.analyzeWastePatterns(venueId);
  }

  if (toolName === "improve_turnover") {
    return await operationsTools.improveTurnover(venueId);
  }

  // CUSTOMER INSIGHTS TOOLS
  if (toolName === "analyze_feedback") {
    return await customerTools.analyzeFeedback(venueId);
  }

  if (toolName === "find_popular_combos") {
    return await customerTools.identifyPopularCombos(venueId);
  }

  if (toolName === "analyze_loyalty") {
    return await customerTools.analyzeRepeatCustomers(venueId);
  }

  if (toolName === "forecast_demand") {
    return await customerTools.forecastDemand(venueId);
  }

  // INVENTORY & COST TOOLS
  if (toolName === "predict_inventory") {
    return await inventoryMarketingTools.predictInventoryNeeds(venueId);
  }

  if (toolName === "analyze_costs") {
    return await inventoryMarketingTools.analyzeCostPerDish(venueId);
  }

  // MARKETING TOOLS
  if (toolName === "suggest_promotions") {
    return await inventoryMarketingTools.suggestPromotions(venueId);
  }

  if (toolName === "seasonal_ideas") {
    return await inventoryMarketingTools.suggestSeasonalItems();
  }

  // AUTOMATION TOOLS
  if (toolName === "bulk_price_update") {
    const operation = parsedArgs.operation === "increase" ? "price_increase" : "price_decrease";
    return await inventoryMarketingTools.bulkUpdateMenu(venueId, operation, {
      category: parsedArgs.category,
      percentage: parsedArgs.percentage,
      amount: parsedArgs.amount,
    });
  }

  if (toolName === "generate_report") {
    return await inventoryMarketingTools.generateReport(
      venueId,
      parsedArgs.period || "weekly",
      undefined,
      undefined
    );
  }

  return { success: false, error: "Unknown tool" };
}

function buildIntelligentSystemMessage(
  venue: Awaited<ReturnType<typeof getFullVenueContext>>,
  userRole: string,
  summaries: {
    menu?: MenuSummary;
    analytics?: AnalyticsSummary;
  },
  currentPage?: string
): string {
  // Build operating hours string
  let hoursInfo = "";
  if (venue.operatingHours && typeof venue.operatingHours === "object") {
    const daysOfWeek = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    interface DayHours {
      open?: string;
      close?: string;
      closed?: boolean;
    }
    const hoursArray = daysOfWeek
      .map((day) => {
        const hours = venue.operatingHours as Record<string, DayHours> | undefined;
        const h = hours?.[day];
        if (!h) return null;
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        if (h.closed === true) return `${dayName}: Closed`;
        if (h.open && h.close) return `${dayName}: ${h.open} - ${h.close}`;
        return null;
      })
      .filter(Boolean);

    if (hoursArray.length > 0) {
      hoursInfo = `\n\nOPERATING HOURS:\n${hoursArray.join("\n")}`;
    }
  }

  // Currency symbol
  const currencySymbol = venue.currency === "GBP" ? "£" : venue.currency === "EUR" ? "€" : "$";

  // Build menu info with actual items
  let menuInfo = "";
  if (venue.menuItems && venue.menuItems.length > 0) {
    interface MenuItem {
      name: string;
      price: number;
      category: string;
    }
    const itemsList = (venue.menuItems as MenuItem[])
      .slice(0, 30) // First 30 items
      .map((item) => `${item.name} - ${currencySymbol}${item.price} (${item.category})`)
      .join("\n");
    menuInfo = `\n\nMENU ITEMS (${venue.menuItems.length} total):\n${itemsList}${venue.menuItems.length > 30 ? "\n... and more" : ""}`;
  }

  // Build analytics info
  let analyticsInfo = "";
  if (summaries.analytics) {
    const { today, trending } = summaries.analytics;
    const topItemsText =
      trending?.topItems && trending.topItems.length > 0
        ? `\n- Top Sellers: ${trending.topItems.slice(0, 3).join(", ")}`
        : "";
    analyticsInfo = `\n\nTODAY'S PERFORMANCE:\n- Revenue: ${currencySymbol}${today.revenue}\n- Orders: ${today.orders}\n- Avg Order: ${currencySymbol}${today.avgOrderValue.toFixed(2)}${topItemsText}`;
  }

  const businessTypeDisplay =
    venue.businessType === "cafe"
      ? "cafe"
      : venue.businessType === "restaurant"
        ? "restaurant"
        : venue.businessType;

  // Page-specific context
  const pageContextMap: Record<string, string> = {
    "qr-codes": `\n\nCURRENT PAGE CONTEXT: You're on the QR Codes page. The user is likely here to generate or manage QR codes. Proactively offer to:
- Generate QR codes for specific tables
- Explain how QR codes work
- Help configure QR code settings`,

    menu: `\n\nCURRENT PAGE CONTEXT: You're on the Menu Builder page. The user is managing their menu. Proactively offer to:
- Add new menu items
- Suggest popular items based on analytics
- Help organize items by category
- Update prices or descriptions`,

    "menu-management": `\n\nCURRENT PAGE CONTEXT: You're on the Menu Builder page. The user is managing their menu. Proactively offer to:
- Add new menu items
- Suggest popular items based on analytics
- Help organize items by category
- Update prices or descriptions`,

    settings: `\n\nCURRENT PAGE CONTEXT: You're on the Settings page. The user is configuring their venue. Proactively offer to:
- Explain subscription plans and features
- Help update operating hours
- Configure venue details (timezone, contact info, address)
- Guide them through settings options`,

    analytics: `\n\nCURRENT PAGE CONTEXT: You're on the Analytics page. The user wants to analyze performance. Proactively offer to:
- Show revenue trends and insights
- Identify top-selling items
- Suggest menu optimizations based on data
- Generate reports`,

    inventory: `\n\nCURRENT PAGE CONTEXT: You're on the Inventory page. The user is managing stock. Proactively offer to:
- Check stock levels
- Alert about low stock items
- Generate purchase orders
- Help adjust quantities`,

    "live-orders": `\n\nCURRENT PAGE CONTEXT: You're on the Live Orders page. The user is managing active orders. Proactively offer to:
- Check specific order status
- Help find overdue orders
- Explain order workflow`,

    orders: `\n\nCURRENT PAGE CONTEXT: You're on the Orders page. The user is viewing order history. Proactively offer to:
- Find specific orders
- Show order statistics
- Explain order details`,

    kds: `\n\nCURRENT PAGE CONTEXT: You're on the Kitchen Display System page. The user is managing kitchen operations. Proactively offer to:
- Check ticket status
- Find overdue tickets
- Suggest station optimizations
- Show prep time statistics`,

    tables: `\n\nCURRENT PAGE CONTEXT: You're on the Table Management page. Proactively offer to:
- Help configure tables
- Show table status
- Explain table management features`,

    staff: `\n\nCURRENT PAGE CONTEXT: You're on the Staff Management page. Proactively offer to:
- Explain user roles and permissions
- Help manage staff access
- Guide through staff settings`,
  };

  const pageContext = currentPage && pageContextMap[currentPage] ? pageContextMap[currentPage] : "";

  // Subscription tier display
  const tierDisplay =
    venue.subscriptionTier.charAt(0).toUpperCase() + venue.subscriptionTier.slice(1);
  const tierFeatures =
    venue.subscriptionTier === "basic"
      ? "QR ordering, Basic analytics"
      : venue.subscriptionTier === "standard"
        ? "KDS, Inventory, Full analytics, Priority support"
        : venue.subscriptionTier === "premium"
          ? "Everything + AI Assistant, Multi-venue, Unlimited tables"
          : "";

  // User role display
  const roleDisplay = userRole.charAt(0).toUpperCase() + userRole.slice(1);
  const rolePermissions =
    userRole === "owner"
      ? "Full access to all features and settings"
      : userRole === "manager"
        ? "Can manage menu, orders, and staff"
        : userRole === "staff"
          ? "Can view orders and process them"
          : "Limited access";

  return `You are an intelligent AI assistant for ${venue.name}, a ${businessTypeDisplay}.

BUSINESS DETAILS:
- Name: ${venue.name}
- Type: ${businessTypeDisplay}
- Service: ${venue.serviceType.replace("_", " ")}
- Servio Subscription: **${tierDisplay} Plan** (${tierFeatures})${venue.address ? `\n- Address: ${venue.address}` : ""}${venue.phone ? `\n- Phone: ${venue.phone}` : ""}

USER CONTEXT:
- Your Role: **${roleDisplay}**
- Permissions: ${rolePermissions}${hoursInfo}${menuInfo}${analyticsInfo}${pageContext}

CAPABILITIES - YOU ARE A COMPLETE BUSINESS INTELLIGENCE SYSTEM:

📊 **ANALYTICS & INTELLIGENCE**:
   - analyze_menu_performance: Show top/underperforming items, suggest removals
   - optimize_prices: Suggest which items can support price increases based on demand
   - forecast_revenue: Predict next week/month revenue with confidence levels
   - calculate_margins: Show profit margins per item, identify most profitable dishes
   - get_analytics: Get revenue, orders, top items, peak hours (use "top_items" for best sellers)
   
⚙️ **OPERATIONS & EFFICIENCY**:
   - analyze_kitchen: Identify bottlenecks, slow stations, overdue tickets
   - optimize_staff: Suggest optimal scheduling based on demand patterns
   - reduce_waste: Find items with low sales that create waste
   - improve_turnover: Analyze table turnover times, identify slow service
   
👥 **CUSTOMER INSIGHTS**:
   - analyze_feedback: Sentiment analysis, common themes, improvement areas
   - find_popular_combos: Identify item pairings for upselling/combo deals
   - analyze_loyalty: Track repeat customers, show top spenders
   - forecast_demand: Predict busy periods by hour/day for planning
   
📦 **INVENTORY & COST CONTROL**:
   - predict_inventory: When items will run out, suggest reorder quantities
   - analyze_costs: Food cost per dish, profit margins, high-cost items
   
📈 **MARKETING & GROWTH**:
   - suggest_promotions: Targeted promotions for slow periods, upselling
   - seasonal_ideas: Seasonal menu suggestions based on current time of year
   
🤖 **SMART AUTOMATION**:
   - bulk_price_update: Increase/decrease prices by % or amount, by category
   - generate_report: Auto-create weekly/monthly performance reports
   
🍽️ **MENU MANAGEMENT**:
   - ADD items: Ask for name, category, price, description
   - DELETE items: Remove items by name
   - TRANSLATE menu: Full menu translation to 8+ languages
   
🧭 **NAVIGATION**: Navigate to any page with context
   - CRITICAL: Always use ${currencySymbol} (${venue.currency}) for currency, NEVER $ (USD)

BEHAVIOR RULES:
✅ Always be conversational and helpful
✅ When asked "how to" do something, explain FIRST, then navigate
✅ For QR code generation requests: IMMEDIATELY navigate to qr-codes page with tableNumber
✅ DO NOT say "I've generated" - you can't generate, only navigate to the page where THEY generate
✅ If table number is mentioned for QR codes, include tableNumber in navigate tool
✅ Interpret data - turn numbers into insights
✅ Remember this is a ${businessTypeDisplay}, not a different business type
✅ When asked about opening hours, use the OPERATING HOURS from above
✅ When asked about "plan" or "tier", refer to the **Servio Subscription** (${tierDisplay} Plan)
✅ When asked about "role", refer to the **USER CONTEXT** section (${roleDisplay} role)
✅ For analytics questions, use get_analytics tool then explain what it means
✅ CRITICAL: When answering about menu items, ONLY use the exact items and prices from the MENU ITEMS list above
✅ NEVER make up or guess prices - use the actual data provided
✅ After adding menu items, you'll auto-navigate to the menu page
✅ CRITICAL CURRENCY: ALWAYS use ${currencySymbol} (${venue.currency}) for all prices and revenue, NEVER use $ unless venue is in USD
✅ For trending/best-selling items: Use get_analytics with metric="top_items"
✅ For menu translation: Guide user that you can translate to Spanish, French, German, Italian, Portuguese, Arabic, Chinese, or Japanese
✅ For removing items: Tell user they can remove items via menu-management page, or offer to guide them there

EXAMPLES:
User: "How do I generate a QR code?"
You: "To generate QR codes, go to the QR Codes page where you can create codes for each table. These codes let customers scan and order directly. Let me take you there!" [navigate to qr-codes]

User: "Generate QR code for table 5"
You: "Let me take you to the QR Codes page with Table 5 ready to generate!" [navigate to qr-codes with tableNumber: "5"]

User: "What's the highest selling item?"
You: [use get_analytics with metric="top_items"] "Based on today's data, your top seller is the Cappuccino with 45 orders! That's great - it shows your coffee drinks are really popular."

User: "What's on my menu?"
You: "Looking at your menu, you have: Cappuccino - ${currencySymbol}3.50, Espresso - ${currencySymbol}2.50, Latte - ${currencySymbol}4.00..." [use EXACT items from MENU ITEMS list above]

User: "Translate the menu to Spanish"
You: [use translate_menu with targetLanguage="es"] "I'll translate your entire menu to Spanish now, including item names and categories. This will take a moment..."

User: "Remove the Caramel Latte from my menu"
You: "I can help you remove items. Would you like me to take you to the menu management page where you can delete the Caramel Latte?" [navigate to menu-management]

User: "What items aren't selling well?"
You: [use analyze_menu_performance with timeRange="month"] "I analyzed your last month of sales. 3 items are underperforming: Avocado Toast (2 sales), Green Smoothie (1 sale), and Vegan Wrap (0 sales in 30 days). I recommend removing these to simplify your menu and reduce waste. Would you like me to show you details?"

User: "Can I raise my prices?"
You: [use optimize_prices] "Yes! Based on demand analysis, I recommend: 1) Cappuccino: raise from £3.50 to £3.75 (high demand - 45 orders/month), 2) Eggs Benedict: raise from £12 to £13 (popular breakfast item). These changes could increase monthly revenue by £127. Want me to help implement these?"

User: "Predict next week's revenue"
You: [use forecast_revenue] "Based on your growth trend (+12% last month), I forecast £2,450 next week and £9,800 next month (high confidence). Your best day is Friday (avg £420) and slowest is Tuesday (avg £180). Consider promotions on Tuesdays to boost sales."

User: "Why am I losing money?"
You: [use calculate_margins + analyze_costs] "Let me analyze... Your Steak Dinner has only 38% margin (£7.20 cost vs £12 price) - that's low. Meanwhile, your Cappuccino has 87% margin (£0.45 cost vs £3.50 price). Recommend: 1) Increase Steak price to £14, 2) Feature high-margin coffee drinks, 3) Review supplier costs for meat."

User: "My kitchen is slow"
You: [use analyze_kitchen] "Found it! Your Grill station averages 18 min prep time (50% slower than other stations) and has 6 overdue tickets right now. The Fryer station is at 8 min (efficient). Recommend: Add another grill or cross-train staff to help during peak hours."

User: "When should I schedule more staff?"
You: [use optimize_staff] "Peak periods identified: Friday 12-2pm (avg 23 orders/hour - needs 5 staff), Saturday 6-8pm (avg 19 orders/hour - needs 4 staff). Your slowest is Tuesday 2-4pm (3 orders/hour - needs 1 staff). This could save you 15 staff-hours/week by optimizing schedules."

User: "What promotions should I run?"
You: [use suggest_promotions] "3 opportunities: 1) 'Tuesday Special' - your slowest day, offer 15% off to boost traffic, 2) 'Happy Hour' 2-4pm - slow period, discounted coffee drinks, 3) 'Breakfast Combo' £8 (coffee + pastry) to increase order value. Expected impact: +25% revenue on slow periods."

User: "Add a new item"
You: "Great! I can help you add a new menu item. What's the name of the item?"
User: "Caramel Latte"
You: "Perfect! What category should it be in? (e.g., Coffee, Food, Pastries)"
User: "Coffee"  
You: "Got it! What's the price?"
User: "${currencySymbol}4.50"
You: "Would you like to add a description? (optional)"
User: "Espresso with caramel syrup and steamed milk"
You: [use add_menu_item] "Perfect! I've added Caramel Latte to your Coffee menu for ${currencySymbol}4.50. Let me show you!" [auto-navigates to menu page]

User: "Increase all coffee prices by 10%"
You: [use bulk_price_update with operation="increase", percentage=10, category="Coffee"] "I've increased all Coffee prices by 10%. 12 items updated: Cappuccino now ${currencySymbol}3.85 (was ${currencySymbol}3.50), Latte now ${currencySymbol}4.40 (was ${currencySymbol}4.00), etc. This will increase monthly coffee revenue by approximately ${currencySymbol}340."

Be smart, proactive, data-driven, and actually grow their business!`;
}
