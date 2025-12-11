// Servio AI Assistant - LLM Service
// Handles intent understanding, planning, and structured output generation
// Updated: 2025-01-07 - QR auto-generation enabled

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { aiLogger as logger } from "@/lib/logger";
import { errorToContext } from "@/lib/utils/error-to-context";
import {
  AIAssistantContext,
  AIPlanResponse,
  ToolName,
  MenuSummary,
  InventorySummary,
  OrdersSummary,
  AnalyticsSummary,
  DEFAULT_GUARDRAILS,
  AssistantPlanSchema,
} from "@/types/ai-assistant";

import { env } from "@/lib/env";

// Lazy initialize OpenAI client
let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) {
    const apiKey = env("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openai = new OpenAI({
      apiKey,
    });
  }
  return openai;
}

// ============================================================================
// Model Selection - Smart routing between GPT-4o-mini (cheap) and GPT-4o (accurate)
// ============================================================================

const MODEL_MINI = "gpt-4o-mini"; // Cost: ~$0.0003/request (90% cheaper)
const MODEL_FULL = "gpt-4o-2024-08-06"; // Cost: ~$0.003/request (most accurate)

// Define which tools require the full GPT-4o model for accuracy
const COMPLEX_TOOLS = new Set<ToolName>([
  "menu.update_prices", // Requires accurate math and multi-item logic
  "menu.translate", // Needs high-quality translations
  "menu.translate_extended", // Complex translation with chunking
  "discounts.create", // Financial impact, needs precision
  "inventory.set_par_levels", // Complex calculations
  "analytics.create_report", // Complex aggregations
  "tables.merge", // Complex table operations
  "qr.generate_bulk", // Bulk operations need accuracy
]);

// Define which tools are simple and work perfectly with mini
const SIMPLE_TOOLS = new Set<ToolName>([
  "navigation.go_to_page", // Simple routing
  "analytics.get_stats", // Direct queries
  "analytics.get_insights", // Direct queries
  "menu.toggle_availability", // Simple boolean toggle
  "orders.mark_served", // Simple status update
  "orders.complete", // Simple status update
  "orders.update_status", // Simple status update
  "kds.get_overdue", // Simple query
  "kds.get_overdue_extended", // Simple query
  "kds.get_station_tickets", // Simple query
  "kds.get_prep_times", // Simple query
  "qr.generate_table", // Simple generation
  "qr.generate_counter", // Simple generation
  "qr.list_all", // Simple query
  "qr.export_pdf", // Simple export
  "menu.query_no_images", // Simple query
  "orders.get_pending", // Simple query
  "orders.get_kitchen", // Simple query
  "orders.get_overdue", // Simple query
  "orders.get_today_stats", // Simple query
  "tables.get_availability", // Simple query
  "tables.get_active_orders", // Simple query
  "tables.get_revenue", // Simple query
  "tables.create", // Simple creation
  "staff.list", // Simple query
  "staff.get_roles", // Simple query
  "staff.get_schedule", // Simple query
  "staff.get_performance", // Simple query
  "staff.invite", // Simple operation
  "inventory.get_low_stock", // Simple query
  "inventory.get_levels", // Simple query
  "inventory.generate_po", // Simple generation
  "inventory.adjust_stock_extended", // Simple adjustment
  "kds.bulk_update", // Simple bulk update
]);

/**
 * Select the appropriate model based on task complexity
 * Returns mini for simple tasks, full for complex ones
 */
function selectModel(userPrompt: string, firstToolName?: ToolName): string {
  // If we know the tool name, use it for decision
  if (firstToolName) {
    if (COMPLEX_TOOLS.has(firstToolName)) {
      return MODEL_FULL;
    }
    if (SIMPLE_TOOLS.has(firstToolName)) {
      return MODEL_MINI;
    }
  }

  // Heuristic: Check prompt for complexity indicators
  const promptLower = userPrompt.toLowerCase();

  // Complex: Multi-step, conditional, comparative operations
  const complexIndicators = [
    "if",
    "but",
    "except",
    "compare",
    "analyze",
    "calculate",
    "optimize",
    "suggest",
    "recommend",
    "except for",
    "as long as",
    "unless",
  ];

  if (complexIndicators.some((indicator) => promptLower.includes(indicator))) {
    return MODEL_FULL;
  }

  // Default to mini for cost savings
  return MODEL_MINI;
}

// ============================================================================
// Response Schema - Now using strict discriminated union from types
// ============================================================================
// AssistantPlanSchema is imported from @/types/ai-assistant
// It uses a strict discriminated union with explicit params for each tool

// ============================================================================
// System Prompt Builder
// ============================================================================

function buildSystemPrompt(
  context: AIAssistantContext,
  dataSummaries: {
    menu?: MenuSummary;
    inventory?: InventorySummary;
    orders?: OrdersSummary;
    analytics?: AnalyticsSummary;
  }
): string {
  const { userRole, venueTier, features } = context;

  return `You are Servio Assistant, an AI helper for business operations. You can help with:

MENU MANAGEMENT:
- Update item prices, availability, and descriptions
- Create new menu items and categories
- Delete menu items
- Translate menu to multiple languages (English, Spanish, French, German, Italian, Portuguese, Arabic, Chinese, Japanese)
- Query items without images
- Add/update images for menu items
- Navigate to menu management pages

INVENTORY MANAGEMENT:
- Adjust stock levels and track ingredients (add/remove units)
- Set par levels and generate purchase orders
- Get low stock items and inventory levels
- Generate purchase orders automatically
- Navigate to inventory pages

ORDERS & KDS:
- Mark orders as served or complete
- Update order status (PLACED, ACCEPTED, IN_PREP, READY, COMPLETED)
- Get pending orders, kitchen orders, and overdue orders
- Get today's order statistics and totals
- Query tickets by station (Grill, Fryer, Barista, etc.)
- Bulk update ticket statuses
- Get station prep times and performance
- Navigate to orders and KDS pages

QR CODE MANAGEMENT:
- Generate QR codes for any table name (e.g., "Table 5", "VIP 3")
- QR codes work immediately - NO table setup required
- Generate bulk QR codes for table ranges (e.g., tables 1-10)
- Generate QR codes for counters
- List all existing QR codes
- Prepare QR code data for PDF export

TABLE MANAGEMENT:
- Show available and occupied tables
- Create new physical tables in the system (requires name and seat count)
- Merge multiple tables together
- Get tables with active orders
- Show revenue by table
- NOTE: QR codes work WITHOUT creating tables - only create tables if user explicitly wants table management

STAFF MANAGEMENT:
- List all staff members with roles
- Invite new staff members (managers or servers)
- Show staff roles and permissions
- Get today's staff schedule
- View staff performance metrics

ANALYTICS & REPORTING:
- Get detailed statistics (revenue, orders, top items, peak hours)
- Create custom reports and exports
- Analyze menu performance
- Navigate to analytics pages

NAVIGATION:
- Take users to any page in the system
- Find specific features and sections

CONTEXT:
- User Role: ${userRole}
- Venue Tier: ${venueTier}
- Timezone: ${context.timezone}
- Features Enabled: ${JSON.stringify(features)}

CURRENT DATA SUMMARIES:
${
  dataSummaries.menu
    ? `\nMENU:
Total Items: ${dataSummaries.menu.totalItems}
Categories: ${dataSummaries.menu.categories.length} (${dataSummaries.menu.categories.map((c: { name: string }) => c.name).join(", ")})
Top Sellers: ${
        dataSummaries.menu.topSellers
          ?.slice(0, 5)
          .map((item: { name: string }) => item.name)
          .join(", ") || "None"
      }
Items Without Images: ${dataSummaries.menu.itemsWithoutImages}
All Items (for reference - use IDs from here): ${JSON.stringify(dataSummaries.menu.allItems?.slice(0, 100) || [], null, 2)}
${dataSummaries.menu.allItems && dataSummaries.menu.allItems.length > 100 ? `\nNote: Showing first 100 of ${dataSummaries.menu.allItems.length} items. Use allItems array to find item IDs by name.` : ""}`
    : ""
}
${dataSummaries.inventory ? `\nINVENTORY:\n${JSON.stringify(dataSummaries.inventory, null, 2)}` : ""}
${dataSummaries.orders ? `\nORDERS:\n${JSON.stringify(dataSummaries.orders, null, 2)}` : ""}
${dataSummaries.analytics ? `\nANALYTICS:\n${JSON.stringify(dataSummaries.analytics, null, 2)}` : ""}

AVAILABLE TOOLS:

QR CODE TOOLS:
- qr.generate_table: Generate QR code for any table name (does NOT create table in database)
- qr.generate_bulk: Generate QR codes for a range (does NOT create tables)
- qr.generate_counter: Generate QR code for counter orders
- qr.list_all: List all existing QR codes (tables and counters)
- qr.export_pdf: Prepare QR codes for PDF download
NOTE: QR codes work immediately without table setup. Only use tables.create if user explicitly wants to manage tables in the system.

MENU TOOLS:
- menu.update_prices: Update prices for menu items
- menu.toggle_availability: Show/hide menu items
- menu.create_item: Create new menu item
- menu.delete_item: Delete menu item
- menu.translate: Translate menu to another language
- menu.translate_extended: Translate menu with category filtering (for large menus)
- menu.query_no_images: Find all items without images
- menu.upload_image: Add/update image for menu item

ORDER TOOLS:
- orders.update_status: Update order status (PLACED, ACCEPTED, IN_PREP, READY, COMPLETED)
- orders.get_pending: Get all pending/active orders
- orders.get_kitchen: Get orders currently in kitchen (IN_PREP status)
- orders.get_overdue: Get overdue orders (taking too long)
- orders.get_today_stats: Get today's order count and revenue
- orders.mark_served: Mark order as served
- orders.complete: Mark order as completed

TABLE TOOLS:
- tables.get_availability: Show available and occupied tables
- tables.create: Create a new table
- tables.merge: Merge multiple tables together
- tables.get_active_orders: Get tables with active orders
- tables.get_revenue: Show revenue by table

STAFF TOOLS:
- staff.list: List all staff members with roles
- staff.invite: Invite new staff member (manager or server)
- staff.get_roles: Show staff roles and permissions
- staff.get_schedule: Get today's staff schedule
- staff.get_performance: View staff performance metrics

KDS TOOLS:
- kds.get_overdue: Get overdue KDS tickets
- kds.get_overdue_extended: Get overdue tickets with threshold
- kds.get_station_tickets: Get tickets for specific station (Grill, Fryer, etc.)
- kds.bulk_update: Bulk update ticket statuses
- kds.get_prep_times: Get average prep times per station
- kds.suggest_optimization: Get kitchen optimization suggestions

INVENTORY TOOLS:
- inventory.adjust_stock: Adjust inventory stock levels
- inventory.adjust_stock_extended: Add/remove units from inventory items
- inventory.get_low_stock: Get items below par level
- inventory.get_levels: Get inventory levels overview
- inventory.generate_po: Generate purchase order
- inventory.set_par_levels: Set par levels for inventory
- inventory.generate_purchase_order: Generate detailed purchase order

ANALYTICS TOOLS:
- analytics.get_insights: Get business insights
- analytics.get_stats: Get detailed statistics
- analytics.export: Export analytics data
- analytics.create_report: Create custom report

NAVIGATION TOOLS:
- navigation.go_to_page: Navigate to any page in the system

GUARDRAILS & SAFETY:
${Object.entries(DEFAULT_GUARDRAILS)
  .map(([tool, rules]) => {
    const constraints = [];
    if (rules.maxPriceChangePercent)
      constraints.push(`max price change ±${rules.maxPriceChangePercent}%`);
    if (rules.maxDiscountPercent) constraints.push(`max discount ${rules.maxDiscountPercent}%`);
    if (rules.maxBulkOperationSize)
      constraints.push(`max ${rules.maxBulkOperationSize} items per call`);
    if (rules.requiresManagerApproval) constraints.push("requires manager approval");
    return constraints.length > 0 ? `- ${tool}: ${constraints.join(", ")}` : "";
  })
  .filter(Boolean)
  .join("\n")}

ROLE-BASED RESTRICTIONS:
- ${userRole === "staff" ? "Staff cannot create discounts, export data, or change par levels" : ""}
- ${userRole === "manager" ? "Manager has full access" : ""}
- ${userRole === "owner" ? "Owner has full access" : ""}

TIER RESTRICTIONS:
- ${venueTier === "starter" ? "Starter tier: no inventory or advanced analytics" : ""}
- ${venueTier === "pro" ? "Pro tier: inventory enabled" : ""}
- ${venueTier === "enterprise" ? "Enterprise tier: all features enabled" : ""}

RULES:
1. ALWAYS set preview=false for: QR generation, navigation, analytics queries, inventory queries, staff listing, table creation, menu create/delete
2. ALWAYS set preview=true for: price changes, bulk updates that modify data (but NOT create/delete)
3. CRITICAL: For QR code requests (including auto-detected table/counter names), you MUST call BOTH tools in order:
   - First: qr.generate_table/qr.generate_counter/qr.generate_bulk with preview=false
   - Second: navigation.go_to_page with page="qr" and preview=false
4. CRITICAL: For menu create/delete operations, you MUST call BOTH tools in order:
   - First: menu.create_item or menu.delete_item with preview=false
   - Second: navigation.go_to_page with page="menu" and appropriate params (itemId, categoryId, action)
5. AUTO-DETECT QR requests: If user mentions "Table X", "VIP X", "Counter X", or table ranges, automatically generate QR codes
6. NEVER skip tool execution - if user says "generate", "create", "delete", you MUST call the tool
7. NEVER exceed guardrail limits (price changes, discounts)
8. RESPECT role and tier restrictions
9. Provide clear reasoning for your plan
10. Warn about potential impacts (revenue, operations)
<<<<<<< HEAD
11. If the request is unclear, ask for clarification in the warnings
=======
11. If the request is unclear or missing required parameters, ask for clarification in the warnings
    - For QR codes: If name/type is missing, ask "What would you like to name this QR code? Is it for a table or counter?"
    - For menu items: If name/price/category is missing, ask for the missing information
    - Return empty tools array [] when clarification is needed, but provide helpful guidance in warnings
>>>>>>> d5057db5a (Improve AI assistant: auto-generate QR codes, menu navigation, context optimization, and error handling)
12. If the request violates guardrails, explain why in warnings
13. Use ONLY the tools available; never hallucinate capabilities
14. When updating prices, preserve significant figures and round appropriately
15. For inventory, always validate units and quantities
16. IMPORTANT: Use the allItems array from MENU data to find item IDs when updating prices or availability
    - Search by item name (case-insensitive, partial matches OK for common items like "coffee", "latte", etc.)
    - Always include the exact UUID from allItems in your params
    - Calculate new prices based on current prices from allItems
    - If menu has >100 items, search efficiently - use first 100 items shown, or search by category
17. EXECUTE ACTIONS, DON'T JUST EXPLAIN: When user says "generate", "create", "delete", "show", "list" - actually call the tool!
18. MULTI-STEP QUERIES: Break complex requests into sequential tool calls. Execute each step and use results to inform next step.

NATURAL LANGUAGE UNDERSTANDING:
- Be flexible with user queries - understand context and intent
- For simple questions that can be answered directly from data summaries:
  * "how many categories are there" → provide direct answer from menu.categories count
  * "how many menu items" → provide direct answer from menu.totalItems count
  * "what categories do I have" → provide direct answer listing menu.categories
  * "total revenue today" → provide direct answer from analytics data if available
  * "how many orders today" → provide direct answer from orders data if available
- For QR code generation requests (AUTO-DETECT AND GENERATE):
  * CRITICAL: If user mentions a table/counter name (e.g., "Table 5", "VIP 3", "Counter 1"), AUTO-GENERATE QR code
  * Patterns to detect:
    - "Table [number]" or "table [number]" → qr.generate_table with tableLabel="Table [number]" (ALWAYS capitalize "Table")
    - "VIP [number]" or "vip [number]" → qr.generate_table with tableLabel="VIP [number]" (ALWAYS capitalize "VIP")
    - "Counter [number]" or "counter [number]" → qr.generate_counter with counterLabel="Counter [number]" (ALWAYS capitalize "Counter")
    - "tables [X]-[Y]" or "tables [X] to [Y]" → qr.generate_bulk with startNumber=X, endNumber=Y
  * CRITICAL: Always normalize table/counter names:
    - "table 5" → "Table 5" (capitalize first letter of each word)
    - "table5" → "Table 5" (add space and capitalize)
    - "Table 5" → "Table 5" (keep as is)
    - Extract just the number if user says "table 5 and a table" → use "Table 5" only
  * Examples that should AUTO-GENERATE:
    - "Table 5" → Generate QR for Table 5
    - "create QR for table 10" → Generate QR for Table 10
    - "I need a QR code for VIP 3" → Generate QR for VIP 3
    - "Counter 1" → Generate QR for Counter 1
    - "tables 1-10" → Generate bulk QR codes
    - "table 5 and a table" → Extract "Table 5" only, ignore "a table" (not a valid name)
    - "table 5 for a table" → Extract "Table 5" only
  * When user provides ambiguous input like "table 5 and a table":
    - Extract the valid table/counter name (e.g., "Table 5")
    - Ignore generic phrases like "a table", "the table", "for table"
    - Use only the specific name with a number or identifier
  * If user says "generate a QR code" or "create QR code" WITHOUT specifying name/type:
    - CRITICAL: DO NOT execute ANY tools - return empty tools array []
    - Add a clear warning: "I need more information to generate a QR code. Please specify: (1) What would you like to name it? (e.g., 'Table 5', 'Counter 1', 'VIP 3') and (2) Is it for a table or counter?"
    - Explain in reasoning: "User requested QR code generation but did not provide the required name/type. Need to ask for clarification before proceeding."
    - DO NOT call qr.generate_table, qr.generate_counter, or navigation.go_to_page
    - Wait for user to provide the name and type in a follow-up message before generating
  * ALWAYS EXECUTE BOTH TOOLS for generation (when name/type is provided):
    TOOL 1: qr.generate_table/qr.generate_counter/qr.generate_bulk with preview=false
    TOOL 2: navigation.go_to_page with page="qr" and preview=false
  * "show me all QR codes" → ONLY navigation: { "name": "navigation.go_to_page", "params": { "page": "qr" }, "preview": false }
  * CRITICAL: You MUST include BOTH tools in the tools array for generation requests (when name/type is provided)
  * CRITICAL: preview must be false for QR tools to actually execute
  * NEVER just explain - ALWAYS call the tools when user mentions table/counter names
<<<<<<< HEAD
=======
  * NEVER generate QR codes without a name - always ask for clarification if name is missing
>>>>>>> d5057db5a (Improve AI assistant: auto-generate QR codes, menu navigation, context optimization, and error handling)
- For complex analytics queries (revenue, sales, stats):
  * "what's the revenue for X" → use analytics.get_stats with metric="revenue", itemId from allItems
  * "how much did X sell" → use analytics.get_stats with metric="revenue", itemId from allItems
  * "show me stats for X" → use analytics.get_stats with itemId from allItems
  * "total revenue" → use analytics.get_stats with metric="revenue", no itemId
  * Default timeRange to "week" if not specified
- For price changes:
  * "increase X by Y%" → find items matching X in allItems, calculate new prices
  * "all coffee items" → match items with "coffee", "espresso", "latte", "cappuccino" etc.
  * "make X cost Y" → find item X, set price to Y
- For menu create/delete operations (ALWAYS NAVIGATE AFTER):
  * "create menu item X" or "add menu item X":
    TOOL 1: menu.create_item with preview=false
    TOOL 2: navigation.go_to_page with page="menu", itemId from result, action="created"
  * "delete menu item X" or "remove menu item X":
    TOOL 1: menu.delete_item with preview=false
    TOOL 2: navigation.go_to_page with page="menu", categoryId from result, action="deleted"
  * CRITICAL: After creating/deleting menu items, ALWAYS navigate to menu page to show changes
  * CRITICAL: Include both tools in sequence - never skip navigation
- For navigation:
  * "take me to", "show me", "go to", "open" → use navigation.go_to_page
  * "add image to X", "upload image for X", "edit image for X" → use navigation.go_to_page with page="menu", itemId from allItems, action="upload_image"
  * Find the item ID from allItems array when user mentions item name
  * Use itemName param to include context in navigation message
- For translation:
  * Supported languages: English (en), Spanish (es), Arabic (ar), French (fr), German (de), Italian (it), Portuguese (pt), Chinese (zh), Japanese (ja)
  * "translate to [language]" → use menu.translate with appropriate language code
- Be intelligent about partial matches and synonyms

OUTPUT FORMAT:
Return a structured plan with:
- intent: what the user wants (clear, natural language)
- tools: ordered array of tool calls with exact params
- reasoning: why this plan is safe and appropriate
- warnings: any caveats or considerations (null if none)`;
}

// ============================================================================
// Planning Function with Smart Model Selection & Fallback
// ============================================================================

// Intelligent Fast-Path Classification (replaces hardcoded patterns)
interface FastPathResult {
  canAnswer: boolean;
  answer?: string;
  confidence: number;
}

// Smart data formatter for natural language responses
function formatDataAsAnswer(data: unknown, question: string): string {
  const lowerQuestion = question.toLowerCase();

  // Number formatting
  if (typeof data === "number") {
    if (
      lowerQuestion.includes("revenue") ||
      lowerQuestion.includes("price") ||
      lowerQuestion.includes("cost") ||
      lowerQuestion.includes("£")
    ) {
      return `£${data.toFixed(2)}`;
    }
    if (lowerQuestion.includes("percent") || lowerQuestion.includes("%")) {
      return `${data.toFixed(1)}%`;
    }
    if (lowerQuestion.includes("time") && data > 1000) {
      return `${Math.round(data)} minutes`;
    }
    return data.toString();
  }

  // Array formatting
  if (Array.isArray(data)) {
    if (data.length === 0) return "None found";

    const formatItem = (item: unknown, index: number): string => {
      if (typeof item === "string") return `${index + 1}. ${item}`;
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        if (obj.name && obj.count && obj.revenue) {
          return `${index + 1}. ${obj.name} - ${obj.count} sold, £${(obj.revenue as number).toFixed(2)} revenue`;
        }
        if (obj.name && obj.revenue) {
          return `${index + 1}. ${obj.name} - £${(obj.revenue as number).toFixed(2)}`;
        }
        if (obj.name && obj.count) {
          return `${index + 1}. ${obj.name} (${obj.count})`;
        }
        if (obj.name && obj.itemCount) {
          return `${index + 1}. ${obj.name} (${obj.itemCount} items)`;
        }
        if (obj.name) return `${index + 1}. ${obj.name}`;
        if (obj.day && obj.orders && obj.revenue) {
          return `${obj.day}: ${obj.orders} orders, £${(obj.revenue as number).toFixed(2)}`;
        }
        if (obj.hour && obj.orderCount) {
          return `${obj.hour}:00 (${obj.orderCount} orders)`;
        }
        if (obj.tableNumber && obj.revenue) {
          return `Table ${obj.tableNumber}: £${(obj.revenue as number).toFixed(2)}${obj.sessions ? ` from ${obj.sessions} sessions` : ""}`;
        }
      }
      return String(item);
    };

    if (data.length <= 10) {
      return data.map(formatItem).join("\n");
    }
    return `${data.length} items total. Top 10:\n` + data.slice(0, 10).map(formatItem).join("\n");
  }

  // Object formatting
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;

    // Revenue/orders object
    if (obj.revenue !== undefined && obj.orders !== undefined) {
      const revenue = obj.revenue as number;
      const orders = obj.orders as number;
      const avg = obj.avgOrderValue as number | undefined;
      return avg
        ? `£${revenue.toFixed(2)} from ${orders} orders (avg £${avg.toFixed(2)} per order)`
        : `£${revenue.toFixed(2)} from ${orders} orders`;
    }

    // Growth object
    if (obj.revenueGrowth !== undefined && obj.ordersGrowth !== undefined) {
      const revGrowth = obj.revenueGrowth as number;
      const ordGrowth = obj.ordersGrowth as number;
      const revDir = revGrowth > 0 ? "up" : "down";
      const ordDir = ordGrowth > 0 ? "up" : "down";
      return `Revenue is ${revDir} ${Math.abs(revGrowth).toFixed(1)}% and orders are ${ordDir} ${Math.abs(ordGrowth).toFixed(1)}% compared to the previous period.`;
    }

    // Category performance
    const entries = Object.entries(obj);
    if (entries.length > 0 && typeof entries[0][1] === "object") {
      const formatted = entries
        .sort((a, b) => {
          const aRev = (a[1] as { revenue?: number })?.revenue || 0;
          const bRev = (b[1] as { revenue?: number })?.revenue || 0;
          return bRev - aRev;
        })
        .map(([key, val]) => {
          const v = val as Record<string, unknown>;
          if (v.revenue && v.count) {
            return `- ${key}: ${v.count} orders, £${(v.revenue as number).toFixed(2)}`;
          }
          if (v.revenue && v.orders) {
            return `- ${key}: £${(v.revenue as number).toFixed(2)} from ${v.orders} orders${v.itemCount ? ` (${v.itemCount} items)` : ""}`;
          }
          return `- ${key}: ${JSON.stringify(v)}`;
        })
        .join("\n");
      return formatted;
    }
  }

  // Fallback
  return String(data);
}

// Navigate nested data paths
function getNestedData(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

async function tryFastPath(
  userPrompt: string,
  dataSummaries: {
    menu?: MenuSummary;
    inventory?: InventorySummary;
    orders?: OrdersSummary;
    analytics?: AnalyticsSummary;
  }
): Promise<FastPathResult> {
  const prompt = userPrompt.toLowerCase().trim();

  // Step 1: Quick action word detection (0ms, 100% accurate)
  const actionWords = [
    "increase",
    "decrease",
    "reduce",
    "raise",
    "lower",
    "change",
    "update",
    "modify",
    "edit",
    "set",
    "create",
    "add",
    "remove",
    "delete",
    "generate",
    "make",
    "translate",
    "hide",
    "show",
    "toggle",
    "send",
    "invite",
    "mark",
    "bump",
    "complete",
    "navigate",
    "go to",
    "take me",
    "open",
    "upload",
  ];

  const hasAction = actionWords.some((word) => prompt.includes(word));
  if (hasAction) {
    return { canAnswer: false, confidence: 1.0 };
  }

  // Step 2: Build data structure summary
  const dataStructure: Record<string, string[]> = {};

  if (dataSummaries.menu) {
    dataStructure.menu = Object.keys(dataSummaries.menu);
  }
  if (dataSummaries.inventory) {
    dataStructure.inventory = Object.keys(dataSummaries.inventory);
  }
  if (dataSummaries.orders) {
    dataStructure.orders = Object.keys(dataSummaries.orders);
  }
  if (dataSummaries.analytics) {
    dataStructure.analytics = Object.keys(dataSummaries.analytics);
  }

  // If no data available, can't answer
  if (Object.keys(dataStructure).length === 0) {
    return { canAnswer: false, confidence: 1.0 };
  }

  // Step 3: Use LLM classifier to determine if data can answer query
  try {
    const classificationPrompt = `User question: "${userPrompt}"

Available data structure:
${JSON.stringify(dataStructure, null, 2)}

Can this question be answered directly from the available data fields?

If yes, provide the exact data path (e.g., "analytics.today.revenue" or "menu.categories").
If the question requires an action, calculation, or tool execution, answer NO.

Respond with JSON only:
{
  "canAnswer": true/false,
  "dataPath": "section.field.subfield" or null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    const response = await getOpenAI().chat.completions.create({
      model: MODEL_MINI,
      messages: [{ role: "user", content: classificationPrompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 150,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    logger.info("[AI FAST-PATH] Classification result:", {
      prompt: userPrompt,
      canAnswer: result.canAnswer,
      dataPath: result.dataPath,
      confidence: result.confidence,
    });

    // High confidence threshold for direct answers
    if (result.canAnswer && result.confidence >= 0.85 && result.dataPath) {
      // Extract data from the identified path
      const data = getNestedData(dataSummaries, result.dataPath);

      if (data !== undefined && data !== null) {
        const answer = formatDataAsAnswer(data, userPrompt);

        return {
          canAnswer: true,
          answer,
          confidence: result.confidence,
        };
      }
    }

    return { canAnswer: false, confidence: result.confidence };
  } catch (error) {
    logger.error("[AI FAST-PATH] Classification failed:", errorToContext(error));
    // Graceful degradation - proceed to full planner
    return { canAnswer: false, confidence: 0 };
  }
}

export async function planAssistantAction(
  userPrompt: string,
  context: AIAssistantContext,
  dataSummaries: {
    menu?: MenuSummary;
    inventory?: InventorySummary;
    orders?: OrdersSummary;
    analytics?: AnalyticsSummary;
  }
): Promise<AIPlanResponse & { modelUsed?: string }> {
  // Try intelligent fast-path (LLM-based classification for read-only queries)
  const fastPath = await tryFastPath(userPrompt, dataSummaries);
  if (fastPath.canAnswer && fastPath.confidence >= 0.85) {
    logger.info("[AI PLANNER] Using fast-path answer", {
      prompt: userPrompt,
      confidence: fastPath.confidence,
      answer: fastPath.answer?.substring(0, 100),
    });
    return {
      intent: userPrompt,
      tools: [],
      reasoning: `Answered directly from data summaries (confidence: ${(fastPath.confidence * 100).toFixed(0)}%)`,
      warnings: null,
      directAnswer: fastPath.answer,
    };
  }

  // Otherwise, use LLM planner for complex queries
  logger.info("[AI PLANNER] Using LLM planner", { prompt: userPrompt });

  const systemPrompt = buildSystemPrompt(context, dataSummaries);

  // Start with model selection based on prompt
  let selectedModel = selectModel(userPrompt);
  let usedFallback = false;

  try {
    // Attempt with selected model
    const completion = await getOpenAI().chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: zodResponseFormat(AssistantPlanSchema, "assistant_plan"),
      temperature: 0.1, // Low temperature for consistent, safe outputs
    });

    // Get the message from completion
    const message = completion.choices[0].message;

    // Try to get parsed response (available when using zodResponseFormat)
    const parsed = (message as { parsed?: unknown }).parsed;

    if (parsed) {
      // Response was successfully parsed and validated by zodResponseFormat
      const typedParsed = parsed as AIPlanResponse;
      return {
        intent: typedParsed.intent,
        tools: typedParsed.tools,
        reasoning: typedParsed.reasoning,
        warnings: typedParsed.warnings,
        modelUsed: selectedModel,
      };
    }

    // Fallback: manually parse and validate content
    const content = message.content;
    if (content) {
      const parsedContent = JSON.parse(content);
      const validated = AssistantPlanSchema.parse(parsedContent);
      return {
        intent: validated.intent,
        tools: validated.tools,
        reasoning: validated.reasoning,
        warnings: validated.warnings,
        modelUsed: selectedModel,
      };
    }

    throw new Error("Failed to parse AI response: no parsed or content available");
  } catch (_error) {
    logger.error(`[AI ASSISTANT] Planning _error with ${selectedModel}:`, errorToContext(_error));

    // If we used mini and got an error, try falling back to full model
    if (selectedModel === MODEL_MINI && !usedFallback) {
      usedFallback = true;
      selectedModel = MODEL_FULL;

      try {
        const completion = await getOpenAI().chat.completions.create({
          model: selectedModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: zodResponseFormat(AssistantPlanSchema, "assistant_plan"),
          temperature: 0.1,
        });

        const message = completion.choices[0].message;
        const parsed = (message as { parsed?: unknown }).parsed;

        if (parsed) {
          const typedParsed = parsed as AIPlanResponse;
          return {
            intent: typedParsed.intent,
            tools: typedParsed.tools,
            reasoning: typedParsed.reasoning,
            warnings: typedParsed.warnings,
            modelUsed: `${selectedModel} (fallback)`,
          };
        }

        const content = message.content;
        if (content) {
          const parsedContent = JSON.parse(content);
          const validated = AssistantPlanSchema.parse(parsedContent);
          return {
            intent: validated.intent,
            tools: validated.tools,
            reasoning: validated.reasoning,
            warnings: validated.warnings,
            modelUsed: `${selectedModel} (fallback)`,
          };
        }
      } catch (fallbackError) {
        logger.error(
          "[AI ASSISTANT] Fallback to GPT-4o also failed:",
          fallbackError as Record<string, unknown>
        );
        // Re-throw the fallback error
        if (fallbackError instanceof z.ZodError) {
          logger.error(
            "[AI ASSISTANT] Zod validation errors:",
            JSON.stringify(fallbackError.errors, null, 2)
          );
        }
        throw fallbackError;
      }
    }

    // If original error wasn't from mini, or fallback also failed
    if (_error instanceof z.ZodError) {
      logger.error("[AI ASSISTANT] Zod validation errors:", JSON.stringify(_error.errors, null, 2));
    }
    throw _error;
  }
}

// ============================================================================
// Explain Action Function (for user clarity)
// ============================================================================

export async function explainAction(
  toolName: ToolName,
  _params: unknown,
  context: AIAssistantContext
): Promise<string> {
  const systemPrompt = `You are Servio Assistant. Explain the following action in simple, human terms.
Be concise (1-2 sentences). Focus on what will change and potential impact.`;

  const userPrompt = `Explain this action:
Tool: ${toolName}
Parameters: ${JSON.stringify(_params || {}, null, 2)}
User Role: ${context.userRole}`;

  try {
    // Use mini for simple explanations (cost savings)
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL_MINI,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    return completion.choices[0].message.content || "Action explanation unavailable.";
  } catch (_error) {
    logger.error("[AI ASSISTANT] Explanation error:", _error as Record<string, unknown>);
    return "Unable to generate explanation.";
  }
}

// ============================================================================
// Suggestion Generator (for contextual prompts)
// ============================================================================

export async function generateSuggestions(
  pageContext: "menu" | "inventory" | "kds" | "orders" | "analytics",
  dataSummary: Record<string, unknown>
): Promise<string[]> {
  const systemPrompt = `Generate 3-4 actionable suggestions for a ${pageContext} dashboard.
Return ONLY a JSON array of strings. Each suggestion should be a natural language command.
Focus on common tasks, optimizations, or insights based on the data.`;

  const userPrompt = `Data: ${JSON.stringify(dataSummary, null, 2)}`;

  try {
    // Use mini for suggestions (cost savings, still good quality)
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL_MINI,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 200,
    });

    const response = JSON.parse(completion.choices[0].message.content || "{ /* Empty */ }");
    return response.suggestions || [];
  } catch (_error) {
    logger.error("[AI ASSISTANT] Suggestion generation error:", _error as Record<string, unknown>);
    return [];
  }
}

// ============================================================================
// Token Usage Tracking & Cost Calculation
// ============================================================================

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string = MODEL_MINI
): number {
  // Pricing as of 2024
  let inputCostPer1k: number;
  let outputCostPer1k: number;

  if (model.includes("gpt-4o-mini")) {
    // GPT-4o-mini pricing (90% cheaper!)
    inputCostPer1k = 0.00015;
    outputCostPer1k = 0.0006;
  } else {
    // GPT-4o pricing
    inputCostPer1k = 0.0025;
    outputCostPer1k = 0.01;
  }

  return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
}

// ============================================================================
// Conversation Title Generation
// ============================================================================

export async function generateConversationTitle(firstUserMessage: string): Promise<string> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: MODEL_MINI, // Use cheaper model for simple title generation
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
  } catch (error) {
    logger.error("[AI] Title generation error:", errorToContext(error));
    return firstUserMessage.substring(0, 60);
  }
}

// Export model constants for use in other modules
export { MODEL_MINI, MODEL_FULL };
