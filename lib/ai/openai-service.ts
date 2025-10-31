// Production OpenAI Integration with Responses API and Tool Calling
// Implements proper tool correlation and error handling

import OpenAI from "openai";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getSystemPrompt(currentPage?: string): string {
  const basePrompt = `You are Servio's venue assistant. Be concise, reliable, and action-oriented.
- If a tool is relevant, call it. If info is uncertain, ask a brief follow-up.
- Never invent data. For totals/revenue/menu items, always use tools.
- Keep replies < 200 words unless asked for more.`;

  const pageSpecificPrompts: Record<string, string> = {
    "qr-codes": `\n\nCURRENT PAGE: QR Codes Management
You're helping manage QR codes for tables. Proactively offer to:
- Generate QR codes for tables
- Help configure QR code settings
- Explain how customers use QR codes
- Navigate to related pages (menu, tables, settings)`,

    "menu-management": `\n\nCURRENT PAGE: Menu Builder
You're helping manage the menu. Proactively offer to:
- Add or remove menu items
- Update prices or descriptions
- Suggest popular menu items based on data
- Organize items into categories
- Toggle item availability`,

    settings: `\n\nCURRENT PAGE: Venue Settings
You're helping configure venue settings. Proactively offer to:
- Show subscription plans and features
- Explain setting options
- Help update operating hours
- Configure venue details (timezone, contact info, address)`,

    analytics: `\n\nCURRENT PAGE: Analytics Dashboard
You're helping analyze venue performance. Proactively offer to:
- Show revenue trends and insights
- Identify top-selling items
- Suggest menu optimizations based on data
- Generate reports`,

    inventory: `\n\nCURRENT PAGE: Inventory Management
You're helping manage inventory. Proactively offer to:
- Check stock levels
- Alert about low stock items
- Generate purchase orders
- Adjust stock quantities`,

    "live-orders": `\n\nCURRENT PAGE: Live Orders
You're helping manage active orders. Proactively offer to:
- Check order status
- Mark orders as complete
- Find overdue orders
- View order details`,

    kds: `\n\nCURRENT PAGE: Kitchen Display System
You're helping with kitchen operations. Proactively offer to:
- Check ticket status
- Find overdue tickets
- Suggest station optimizations
- View prep times`,

    tables: `\n\nCURRENT PAGE: Table Management
You're helping manage tables. Proactively offer to:
- View table status
- Manage reservations
- Configure table layout`,

    staff: `\n\nCURRENT PAGE: Staff Management
You're helping manage staff. Proactively offer to:
- View staff roles
- Help with permissions
- Navigate to related settings`,
  };

  const pagePrompt =
    currentPage && pageSpecificPrompts[currentPage] ? pageSpecificPrompts[currentPage] : "";

  return basePrompt + pagePrompt;
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_todays_revenue",
      description: "Return today's revenue in the venue's local currency.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          venue_id: {
            type: "string",
            description: "Venue UUID",
          },
        },
        required: ["venue_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_menu_items",
      description: "Get menu items for the venue.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          venue_id: {
            type: "string",
            description: "Venue UUID",
          },
          category: {
            type: "string",
            description: "Optional category filter",
          },
        },
        required: ["venue_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_menu_price",
      description: "Update the price of a menu item.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          venue_id: {
            type: "string",
            description: "Venue UUID",
          },
          item_id: {
            type: "string",
            description: "Menu item ID",
          },
          new_price: {
            type: "number",
            description: "New price",
          },
        },
        required: ["venue_id", "item_id", "new_price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_page",
      description: "Open a page inside the dashboard.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          page: {
            type: "string",
            enum: ["orders", "menu", "tables", "settings", "analytics", "dashboard"],
          },
          subpage: {
            type: "string",
            description: "Optional subpage",
          },
        },
        required: ["page"],
      },
    },
  },
];

interface Message {
  id: string;
  authorRole: "system" | "user" | "assistant" | "tool";
  text: string;
  content: unknown;
  callId?: string;
  toolName?: string;
  createdAt: string;
}

export async function handleUserMessage({
  venueId,
  conversationId,
  userText,
  userId: _userId,
  currentPage,
}: {
  venueId: string;
  conversationId: string;
  userText: string;
  userId: string;
  currentPage?: string;
}): Promise<{ response: string; toolResults?: unknown[] }> {
  const supabase = await createClient();

  try {
    // 1) Load the last 30 messages to maintain context
    const { data: messages } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(30);

    // 2) Transform to OpenAI format
    const history = (messages || []).reverse().map((msg) => ({
      role: msg.author_role,
      content: msg.text || "",
    }));

    // Get dynamic system prompt based on current page
    const systemPrompt = getSystemPrompt(currentPage);

    const openaiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...history,
      { role: "user" as const, content: userText },
    ];

    // 3) First model call
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
    });

    const message = response.choices[0].message;
    const toolCalls = message.tool_calls || [];
    const toolResults: unknown[] = [];

    // 4) Handle tool calls
    if (toolCalls.length > 0) {
      const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...openaiMessages,
        message,
      ];

      for (const toolCall of toolCalls) {
        // Access the function property and extract details
        const callId = toolCall.id;
        if (toolCall.type !== "function") continue;
        const functionCall = toolCall.function;
        const name = functionCall.name;
        const args = functionCall.arguments;
        const parsedArgs = JSON.parse(args);

        let toolResult: unknown;

        try {
          // Execute the tool
          switch (name) {
            case "get_todays_revenue":
              toolResult = await executeGetTodaysRevenue(parsedArgs.venue_id);
              break;
            case "get_menu_items":
              toolResult = await executeGetMenuItems(parsedArgs.venue_id, parsedArgs.category);
              break;
            case "update_menu_price":
              toolResult = await executeUpdateMenuPrice(
                parsedArgs.venue_id,
                parsedArgs.item_id,
                parsedArgs.new_price
              );
              break;
            case "open_page":
              toolResult = await executeOpenPage(parsedArgs.page, parsedArgs.subpage);
              break;
            default:
              toolResult = { error: `Unknown tool: ${name}` };
          }

          // Save tool message
          await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            venue_id: venueId,
            author_role: "tool",
            text: JSON.stringify(toolResult),
            content: toolResult,
            call_id: callId,
            tool_name: name,
          });

          toolResults.push({ tool: name, result: toolResult });

          // Add tool result to messages for final response
          toolMessages.push({
            role: "tool" as const,
            content: JSON.stringify(toolResult),
            tool_call_id: callId,
          });
        } catch (_error) {
          logger.error(
            `[AI] Tool execution _error for ${name}:`,
            _error as Record<string, unknown>
          );
          toolResult = {
            error: `Tool execution failed: ${_error instanceof Error ? _error.message : "Unknown error"}`,
          };

          await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            venue_id: venueId,
            author_role: "tool",
            text: JSON.stringify(toolResult),
            content: toolResult,
            call_id: callId,
            tool_name: name,
          });

          // Add error result to messages
          toolMessages.push({
            role: "tool" as const,
            content: JSON.stringify(toolResult),
            tool_call_id: callId,
          });
        }
      }

      // 5) Get final assistant response
      const finalResponse = await client.chat.completions.create({
        model: "gpt-4o",
        messages: toolMessages,
        temperature: 0.7,
      });

      const finalMessage = finalResponse.choices[0].message;

      // Save assistant message
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        venue_id: venueId,
        author_role: "assistant",
        text: finalMessage.content || "",
        content: { text: finalMessage.content || "" },
      });

      return {
        response: finalMessage.content || "I've completed the requested actions.",
        toolResults,
      };
    } else {
      // No tool calls, just save the response
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        venue_id: venueId,
        author_role: "assistant",
        text: message.content || "",
        content: { text: message.content || "" },
      });

      return {
        response: message.content || "I understand your request.",
        toolResults: [],
      };
    }
  } catch (_error) {
    logger.error("[AI] OpenAI service error:", _error as Record<string, unknown>);
    throw new Error(
      `AI service error: ${_error instanceof Error ? _error.message : "Unknown error"}`
    );
  }
}

// Tool execution functions
async function executeGetTodaysRevenue(venueId: string) {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("venue_id", venueId)
    .gte("created_at", new Date().toISOString().split("T")[0]);

  const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

  return {
    venue_id: venueId,
    date: new Date().toISOString().split("T")[0],
    total_revenue: totalRevenue,
    currency: "GBP",
  };
}

async function executeGetMenuItems(venueId: string, category?: string) {
  const supabase = await createClient();

  let query = supabase.from("menu_items").select("*").eq("venue_id", venueId);

  if (category) {
    query = query.eq("category", category);
  }

  const { data: items } = await query;

  return {
    venue_id: venueId,
    category: category || "all",
    items: items || [],
    count: items?.length || 0,
  };
}

async function executeUpdateMenuPrice(venueId: string, itemId: string, newPrice: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("menu_items")
    .update({
      price: newPrice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("venue_id", venueId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update price: ${error.message}`);
  }

  return {
    success: true,
    item_id: itemId,
    old_price: data.price,
    new_price: newPrice,
    updated_at: data.updated_at,
  };
}

async function executeOpenPage(page: string, subpage?: string) {
  // This would typically trigger a client-side navigation
  // For now, return the navigation instruction
  return {
    action: "navigate",
    page: page,
    subpage: subpage,
    url: `/dashboard/${page}${subpage ? `/${subpage}` : ""}`,
  };
}

export async function generateConversationTitle(firstUserMessage: string): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Make a 5-word title for this chat: "${firstUserMessage}". Return only the title.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 20,
    });

    const title = response.choices[0].message.content?.trim() || "New Chat";
    return title.substring(0, 60); // Limit length
  } catch (_error) {
    logger.error("[AI] Title generation error:", _error as Record<string, unknown>);
    return firstUserMessage.substring(0, 60);
  }
}
