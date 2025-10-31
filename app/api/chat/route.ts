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

export const maxDuration = 30;

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

    // Define tools with QR code generation
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
          description: "Get real business analytics and stats",
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
                description: "Price in dollars/pounds",
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
        if (toolCall.function.name === "add_menu_item" && (result as any).shouldNavigate) {
          navigationInfo = {
            route: getNavigationRoute((result as any).navigateTo, venueId),
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

  // Get all venue details including owner
  const { data: venue } = await supabase
    .from("venues")
    .select("*")
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

    return {
      success: true,
      message: `Successfully added "${name}" to the menu under ${category} for $${price}`,
      item: data,
      shouldNavigate: true,
      navigateTo: "menu",
    };
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
    const hoursArray = daysOfWeek
      .map((day) => {
        const h = (venue.operatingHours as Record<string, any>)[day];
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

  // Build menu info with actual items
  let menuInfo = "";
  if (venue.menuItems && venue.menuItems.length > 0) {
    const itemsList = venue.menuItems
      .slice(0, 30) // First 30 items
      .map((item: any) => `${item.name} - $${item.price} (${item.category})`)
      .join("\n");
    menuInfo = `\n\nMENU ITEMS (${venue.menuItems.length} total):\n${itemsList}${venue.menuItems.length > 30 ? "\n... and more" : ""}`;
  }

  // Build analytics info
  let analyticsInfo = "";
  if (summaries.analytics) {
    const { today } = summaries.analytics;
    analyticsInfo = `\n\nTODAY'S PERFORMANCE:\n- Revenue: $${today.revenue}\n- Orders: ${today.orders}\n- Avg Order: $${today.avgOrderValue.toFixed(2)}`;
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

CAPABILITIES:
1. **Navigation**: Navigate to pages (qr-codes, analytics, menu, settings, etc.)
   - When user asks HOW to do something, EXPLAIN first, then offer to navigate
   - For QR codes: You can navigate with tableNumber parameter to highlight specific tables
   
2. **Analytics**: Get real-time business data (revenue, orders, top items, peak hours)
   - Always INTERPRET the data in context - don't just repeat numbers
   
3. **Menu Knowledge**: You have full access to all menu items listed above
   - Answer questions about items, prices, what's on the menu
   
4. **Add Menu Items**: You can add new items interactively
   - If user says "add an item", ask for: name, category, price, and optionally description
   - Once you have all info, use add_menu_item tool
   
5. **Business Advice**: Use your knowledge to give actionable insights

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

EXAMPLES:
User: "How do I generate a QR code?"
You: "To generate QR codes, go to the QR Codes page where you can create codes for each table. These codes let customers scan and order directly. Let me take you there!" [navigate to qr-codes]

User: "Generate QR code for table 5"
You: "Let me take you to the QR Codes page with Table 5 ready to generate!" [navigate to qr-codes with tableNumber: "5"]

User: "What's the highest selling item?"
You: [use get_analytics] "Based on today's data, your top seller is the Cappuccino with 45 orders! That's great - it shows your coffee drinks are really popular."

User: "What's on my menu?"
You: "Looking at your menu, you have: Cappuccino - $3.50, Espresso - $2.50, Latte - $4.00..." [use EXACT items from MENU ITEMS list above]

User: "Add a new item"
You: "Great! I can help you add a new menu item. What's the name of the item?"
User: "Caramel Latte"
You: "Perfect! What category should it be in? (e.g., Coffee, Food, Pastries)"
User: "Coffee"  
You: "Got it! What's the price?"
User: "$4.50"
You: "Would you like to add a description? (optional)"
User: "Espresso with caramel syrup and steamed milk"
You: [use add_menu_item] "Perfect! I've added Caramel Latte to your Coffee menu for $4.50. Let me show you!" [auto-navigates to menu page]

Be smart, contextual, and actually helpful!`;
}
