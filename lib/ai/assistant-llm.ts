// Servio AI Assistant - LLM Service
// Handles intent understanding, planning, and structured output generation
// Updated: 2025-01-07 - QR auto-generation enabled

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

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

CONVERSATIONAL RESPONSES:
- For greetings like "hi", "hello", "hey": Respond warmly with "Hello! How can I help you with your hospitality business today?"
- For "thank you", "thanks": Respond with "You're welcome! Is there anything else I can help you with?"
- For "how are you", "how's it going": Respond conversationally about being ready to help
- For general questions about yourself: Explain your role as an AI assistant for hospitality operations
- Keep responses friendly and professional, but focus on business operations
- If user is just chatting, gently steer conversation toward business tasks

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
   - Second: navigation.go_to_page with page="qr" or page="qr-codes", preview=false, AND pass the table/counter name:
     * If qr.generate_table was called with tableLabel="Table X", use navigation with table="Table X"
     * If qr.generate_counter was called with counterLabel="Counter X", use navigation with counter="Counter X"
     * Example: { "name": "navigation.go_to_page", "params": { "page": "qr", "table": "Table 6" }, "preview": false }
4. CRITICAL: For menu create/delete operations, you MUST call BOTH tools in order:
   - First: menu.create_item or menu.delete_item with preview=false
   - Second: navigation.go_to_page with page="menu" and appropriate params (itemId, categoryId, action)
5. AUTO-DETECT QR requests: If user mentions "Table X", "VIP X", "Counter X", or table ranges, automatically generate QR codes
6. NEVER skip tool execution - if user says "generate", "create", "delete", you MUST call the tool
7. NEVER exceed guardrail limits (price changes, discounts)
8. RESPECT role and tier restrictions
9. Provide clear reasoning for your plan
10. Warn about potential impacts (revenue, operations)
11. If the request is unclear or missing required parameters, ask for clarification in the warnings
    - For QR codes: If name/type is missing, ask "What would you like to name this QR code? Is it for a table or counter?"
    - For menu items: If name/price/category is missing, ask for the missing information
    - Return empty tools array [] when clarification is needed, but provide helpful guidance in warnings
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
- CRITICAL: For questions that ask about data/information (not actions), you MUST provide a directAnswer
- For simple questions that can be answered directly from data summaries, return EMPTY tools array [] and provide a directAnswer:
  * "how many categories are there" → directAnswer: list from menu.categories count
  * "how many menu items" → directAnswer: from menu.totalItems count
  * "what categories do I have" → directAnswer: list all menu.categories with their item counts
  * "total revenue today" → directAnswer: from analytics.today.revenue
  * "how many orders today" → directAnswer: from analytics.today.orders
  * "which items don't have images" → directAnswer: explain there are X items without images, suggest using menu.query_no_images or navigating to menu
  * "how many items in coffee category" → directAnswer: find "Coffee" in menu.categories and return itemCount
  * "top sellers" → directAnswer: list menu.topSellers with sales and revenue
  * "peak hours" → directAnswer: from analytics.timeAnalysis.peakHours
  * "busiest day" → directAnswer: from analytics.timeAnalysis.busiestDay
  * "low stock items" → directAnswer: list inventory.lowStock items
- IMPORTANT: If you can answer from the data summaries provided, DO NOT return tools. Return directAnswer instead.
- directAnswer should be a helpful, conversational response that directly answers the question
- For QR code generation requests (AUTO-DETECT AND GENERATE):
  * CRITICAL: If user mentions a table/counter name (e.g., "Table 5", "VIP 3", "Counter 1"), AUTO-GENERATE QR code
  * Patterns to detect:
    - "Table [number]" or "table [number]" → qr.generate_table with tableLabel="Table [number]" (ALWAYS capitalize "Table")
    - "VIP [number]" or "vip [number]" → qr.generate_table with tableLabel="VIP [number]" (ALWAYS capitalize "VIP")
    - "Counter [number]" or "counter [number]" → qr.generate_counter with counterLabel="Counter [number]" (ALWAYS capitalize "Counter")
    - "tables [X]-[Y]" or "tables [X] to [Y]" → qr.generate_bulk with startNumber=X, endNumber=Y, prefix="Table", type="table"
    - "counters [X]-[Y]" or "counters [X] to [Y]" → qr.generate_bulk with startNumber=X, endNumber=Y, prefix="Counter", type="counter"
    - "VIP [X]-[Y]" → qr.generate_bulk with startNumber=X, endNumber=Y, prefix="VIP", type="table"
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
  * If user says "generate QR codes" or "create QR codes" (plural) WITHOUT specifying prefix/amount/type:
    - CRITICAL: DO NOT execute ANY tools - return empty tools array []
    - Add a clear warning: "I need more information to generate QR codes in bulk. Please specify: (1) What prefix would you like? (e.g., 'Table', 'VIP', 'Counter') (2) How many QR codes? (e.g., 10, 20) and (3) Are they for tables or counters?"
    - Explain in reasoning: "User requested bulk QR code generation but did not provide prefix, count, or type. Need to ask for clarification before proceeding."
    - DO NOT call qr.generate_bulk or navigation.go_to_page
    - Wait for user to provide prefix, count, and type in a follow-up message before generating
  * ALWAYS EXECUTE BOTH TOOLS for generation (when name/type is provided):
    TOOL 1: qr.generate_table/qr.generate_counter/qr.generate_bulk with preview=false
    TOOL 2: navigation.go_to_page with page="qr" or page="qr-codes", preview=false:
      - For single table: { "name": "navigation.go_to_page", "params": { "page": "qr", "table": "Table 6" }, "preview": false }
      - For single counter: { "name": "navigation.go_to_page", "params": { "page": "qr", "counter": "Counter 1" }, "preview": false }
      - For bulk generation: { "name": "navigation.go_to_page", "params": { "page": "qr", "bulkPrefix": "Table", "bulkCount": 10, "bulkType": "table" }, "preview": false }
        * bulkPrefix MUST match the prefix used in qr.generate_bulk (e.g., "Table", "VIP", "Counter")
        * bulkCount MUST match the number of QR codes generated (endNumber - startNumber + 1)
        * bulkType MUST match the type used in qr.generate_bulk ("table" or "counter")
      - The table/counter/bulk values MUST match exactly what was passed to the QR generation tool
  * "show me all QR codes" → ONLY navigation: { "name": "navigation.go_to_page", "params": { "page": "qr" }, "preview": false }
  * CRITICAL: You MUST include BOTH tools in the tools array for generation requests (when name/type is provided)
  * CRITICAL: preview must be false for QR tools to actually execute
  * CRITICAL: The navigation tool MUST include the table or counter parameter to auto-generate the QR code on the page
  * NEVER just explain - ALWAYS call the tools when user mentions table/counter names
  * NEVER generate QR codes without a name - always ask for clarification if name is missing
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
      - CRITICAL: categoryId must be a UUID from menu.categories array
      - If user provides category name (e.g., "Desserts"), find the matching category ID from menu.categories
      - Example: If menu.categories has { id: "uuid-123", name: "Desserts" }, use categoryId="uuid-123"
      - If category not found, return empty tools array [] and ask user to specify an existing category
    TOOL 2: navigation.go_to_page with page="menu", itemId from result, itemName from params, action="created"
  * "delete menu item X" or "remove menu item X":
    TOOL 1: menu.delete_item with preview=false
    TOOL 2: navigation.go_to_page with page="menu", categoryId from result, action="deleted"
  * CRITICAL: After creating/deleting menu items, ALWAYS navigate to menu page to show changes
  * CRITICAL: Include both tools in sequence - never skip navigation
  * CRITICAL: Always resolve category names to category IDs from the menu.categories array
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
- tools: ordered array of tool calls with exact params (EMPTY [] for informational queries)
- reasoning: why this plan is safe and appropriate
- warnings: any caveats or considerations (null if none)
- directAnswer: For informational queries that can be answered from data summaries, provide the answer here (null if tools are being executed)

CRITICAL OUTPUT RULES:
1. For ACTION requests (create, delete, update, generate, etc.) → use tools array, directAnswer should be null
2. For INFORMATION requests (how many, what is, which items, show me, tell me, etc.) → use directAnswer, tools should be empty []
3. NEVER return both empty tools AND null directAnswer - one must have a value
4. If you can answer from the DATA SUMMARIES provided above, ALWAYS use directAnswer

Examples of informational queries that should use directAnswer:
- "How many items are in the coffee category?" → directAnswer with count from menu.categories
- "Which items don't have images?" → directAnswer mentioning the count and suggesting how to see them
- "What's my revenue today?" → directAnswer with value from analytics.today.revenue
- "What are my categories?" → directAnswer listing all categories
- "Show me my top sellers" → directAnswer listing topSellers from menu data`;
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

// ============================================================================
// Direct Pattern Matching for Common Queries
// ============================================================================

interface DirectQueryResult {
  matched: boolean;
  answer?: string;
}

/**
 * Try to answer common queries directly from data summaries
 * This is faster and more reliable than LLM classification for well-known patterns
 */
function tryDirectPatternMatch(
  userPrompt: string,
  dataSummaries: {
    menu?: MenuSummary;
    inventory?: InventorySummary;
    orders?: OrdersSummary;
    analytics?: AnalyticsSummary;
  }
): DirectQueryResult {
  const prompt = userPrompt.toLowerCase().trim();

  // ========== MENU QUERIES ==========

  // Items without images
  if (
    prompt.includes("without image") ||
    prompt.includes("no image") ||
    prompt.includes("don't have image") ||
    prompt.includes("dont have image") ||
    prompt.includes("missing image") ||
    prompt.includes("need image") ||
    (prompt.includes("which") && prompt.includes("image"))
  ) {
    if (dataSummaries.menu) {
      const count = dataSummaries.menu.itemsWithoutImages;
      if (count === 0) {
        return { matched: true, answer: "All your menu items have images! 🎉" };
      }
      // We have the count but not the specific items - suggest using the tool or navigating
      return {
        matched: true,
        answer: `You have ${count} menu item${count === 1 ? "" : "s"} without images. Navigate to Menu Management to see and add images to these items.`,
      };
    }
  }

  // Category count
  if (
    (prompt.includes("how many") && prompt.includes("categor")) ||
    (prompt.includes("number of") && prompt.includes("categor"))
  ) {
    if (dataSummaries.menu) {
      const count = dataSummaries.menu.categories.length;
      return {
        matched: true,
        answer: `You have ${count} menu categor${count === 1 ? "y" : "ies"}: ${dataSummaries.menu.categories.map((c) => c.name).join(", ")}.`,
      };
    }
  }

  // Items in specific category
  const categoryCountMatch = prompt.match(
    /how many (?:items?|products?|dishes?|things?)?\s*(?:are |do i have |in |for |under )?\s*(?:in |under |the )?(?:the )?['""]?(\w+(?:\s+\w+)?)['""]?\s*(?:category|section)?/i
  );
  if (
    categoryCountMatch ||
    (prompt.includes("how many") &&
      (prompt.includes("in") || prompt.includes("under") || prompt.includes("for")) &&
      dataSummaries.menu?.categories.some((c) => prompt.includes(c.name.toLowerCase())))
  ) {
    if (dataSummaries.menu) {
      // Try to find the category mentioned
      const categories = dataSummaries.menu.categories;
      for (const category of categories) {
        if (prompt.includes(category.name.toLowerCase())) {
          return {
            matched: true,
            answer: `The ${category.name} category has ${category.itemCount} item${category.itemCount === 1 ? "" : "s"}.`,
          };
        }
      }
    }
  }

  // List categories
  if (
    prompt.includes("what categor") ||
    prompt.includes("which categor") ||
    prompt.includes("list categor") ||
    prompt.includes("show categor") ||
    (prompt.includes("my") && prompt.includes("categor"))
  ) {
    if (dataSummaries.menu) {
      const cats = dataSummaries.menu.categories;
      if (cats.length === 0) {
        return { matched: true, answer: "You don't have any menu categories yet. Would you like to create one?" };
      }
      const catList = cats.map((c) => `• ${c.name} (${c.itemCount} items)`).join("\n");
      return {
        matched: true,
        answer: `You have ${cats.length} menu categories:\n${catList}`,
      };
    }
  }

  // Total menu items
  if (
    (prompt.includes("how many") && (prompt.includes("menu item") || prompt.includes("item") || prompt.includes("product"))) ||
    (prompt.includes("total") && prompt.includes("item"))
  ) {
    // Make sure we're not asking about a specific category
    const isSpecificCategory = dataSummaries.menu?.categories.some((c) =>
      prompt.includes(c.name.toLowerCase())
    );
    if (!isSpecificCategory && dataSummaries.menu) {
      return {
        matched: true,
        answer: `You have ${dataSummaries.menu.totalItems} menu items across ${dataSummaries.menu.categories.length} categories.`,
      };
    }
  }

  // Top sellers
  if (
    prompt.includes("top seller") ||
    prompt.includes("best seller") ||
    prompt.includes("most popular") ||
    prompt.includes("selling best")
  ) {
    if (dataSummaries.menu?.topSellers && dataSummaries.menu.topSellers.length > 0) {
      const topItems = dataSummaries.menu.topSellers.slice(0, 5);
      const itemList = topItems
        .map((item, i) => `${i + 1}. ${item.name} - ${item.sales7d} sold (£${item.revenue7d.toFixed(2)})`)
        .join("\n");
      return {
        matched: true,
        answer: `Your top selling items (last 7 days):\n${itemList}`,
      };
    }
  }

  // Average price
  if (prompt.includes("average price") || prompt.includes("avg price") || prompt.includes("mean price")) {
    if (dataSummaries.menu) {
      return {
        matched: true,
        answer: `Your average menu item price is £${dataSummaries.menu.avgPrice.toFixed(2)}. Prices range from £${dataSummaries.menu.priceRange.min.toFixed(2)} to £${dataSummaries.menu.priceRange.max.toFixed(2)}.`,
      };
    }
  }

  // ========== ANALYTICS QUERIES ==========

  // Revenue today
  if (
    (prompt.includes("revenue") || prompt.includes("sales")) &&
    (prompt.includes("today") || prompt.includes("today's"))
  ) {
    if (dataSummaries.analytics) {
      const today = dataSummaries.analytics.today;
      return {
        matched: true,
        answer: `Today's revenue is £${today.revenue.toFixed(2)} from ${today.orders} orders (avg £${today.avgOrderValue.toFixed(2)} per order).`,
      };
    }
  }

  // Orders today
  if (
    prompt.includes("order") &&
    (prompt.includes("today") || prompt.includes("today's")) &&
    (prompt.includes("how many") || prompt.includes("total") || prompt.includes("count"))
  ) {
    if (dataSummaries.analytics) {
      return {
        matched: true,
        answer: `You've had ${dataSummaries.analytics.today.orders} orders today with total revenue of £${dataSummaries.analytics.today.revenue.toFixed(2)}.`,
      };
    }
  }

  // Revenue this week
  if (
    (prompt.includes("revenue") || prompt.includes("sales")) &&
    (prompt.includes("this week") || prompt.includes("week"))
  ) {
    if (dataSummaries.analytics) {
      const thisWeek = dataSummaries.analytics.thisWeek;
      return {
        matched: true,
        answer: `This week's revenue is £${thisWeek.revenue.toFixed(2)} from ${thisWeek.orders} orders.`,
      };
    }
  }

  // Peak hours
  if (prompt.includes("peak hour") || prompt.includes("busiest hour") || prompt.includes("busy time")) {
    if (dataSummaries.analytics?.timeAnalysis.peakHours) {
      const peaks = dataSummaries.analytics.timeAnalysis.peakHours.slice(0, 3);
      const peakList = peaks.map((p) => `${p.hour}:00 (${p.orderCount} orders)`).join(", ");
      return {
        matched: true,
        answer: `Your peak hours are: ${peakList}. ${dataSummaries.analytics.timeAnalysis.busiestDay} is your busiest day.`,
      };
    }
  }

  // Busiest day
  if (prompt.includes("busiest day") || prompt.includes("best day")) {
    if (dataSummaries.analytics?.timeAnalysis.busiestDay) {
      return {
        matched: true,
        answer: `Your busiest day is ${dataSummaries.analytics.timeAnalysis.busiestDay}.`,
      };
    }
  }

  // Growth comparison
  if (
    prompt.includes("growth") ||
    prompt.includes("compared to") ||
    prompt.includes("vs last") ||
    prompt.includes("versus last")
  ) {
    if (dataSummaries.analytics?.growth) {
      const growth = dataSummaries.analytics.growth;
      const revDir = growth.revenueGrowth >= 0 ? "up" : "down";
      const ordDir = growth.ordersGrowth >= 0 ? "up" : "down";
      return {
        matched: true,
        answer: `Compared to the previous week: Revenue is ${revDir} ${Math.abs(growth.revenueGrowth).toFixed(1)}% and orders are ${ordDir} ${Math.abs(growth.ordersGrowth).toFixed(1)}%.`,
      };
    }
  }

  // ========== INVENTORY QUERIES ==========

  // Low stock
  if (prompt.includes("low stock") || prompt.includes("running low") || prompt.includes("need to reorder")) {
    if (dataSummaries.inventory) {
      const lowStock = dataSummaries.inventory.lowStock;
      if (lowStock.length === 0) {
        return { matched: true, answer: "All inventory items are well-stocked! No items below reorder level." };
      }
      const itemList = lowStock
        .slice(0, 5)
        .map((i) => `• ${i.name}: ${i.onHand} ${i.unit} (reorder at ${i.reorderLevel})`)
        .join("\n");
      return {
        matched: true,
        answer: `You have ${lowStock.length} item${lowStock.length === 1 ? "" : "s"} running low:\n${itemList}${lowStock.length > 5 ? `\n...and ${lowStock.length - 5} more` : ""}`,
      };
    }
  }

  // Out of stock
  if (prompt.includes("out of stock") || prompt.includes("no stock")) {
    if (dataSummaries.inventory) {
      const outOfStock = dataSummaries.inventory.outOfStock;
      if (outOfStock.length === 0) {
        return { matched: true, answer: "No items are out of stock! 🎉" };
      }
      return {
        matched: true,
        answer: `${outOfStock.length} item${outOfStock.length === 1 ? " is" : "s are"} out of stock: ${outOfStock.join(", ")}.`,
      };
    }
  }

  // ========== ORDERS QUERIES ==========

  // Live orders
  if (
    prompt.includes("live order") ||
    prompt.includes("active order") ||
    prompt.includes("current order") ||
    prompt.includes("pending order")
  ) {
    if (dataSummaries.orders) {
      return {
        matched: true,
        answer: `You have ${dataSummaries.orders.liveOrders} live order${dataSummaries.orders.liveOrders === 1 ? "" : "s"} right now.`,
      };
    }
  }

  // Overdue tickets
  if (prompt.includes("overdue") && (prompt.includes("ticket") || prompt.includes("order"))) {
    if (dataSummaries.orders) {
      const overdue = dataSummaries.orders.overdueTickets;
      if (overdue.length === 0) {
        return { matched: true, answer: "No overdue tickets! All orders are on track. 🎉" };
      }
      const ticketList = overdue
        .slice(0, 3)
        .map((t) => `• ${t.station}: ${t.items.join(", ")} (${t.minutesOverdue} min overdue)`)
        .join("\n");
      return {
        matched: true,
        answer: `You have ${overdue.length} overdue ticket${overdue.length === 1 ? "" : "s"}:\n${ticketList}`,
      };
    }
  }

  // Average prep time
  if (prompt.includes("prep time") || prompt.includes("preparation time") || prompt.includes("cooking time")) {
    if (dataSummaries.orders) {
      return {
        matched: true,
        answer: `Average preparation time is ${dataSummaries.orders.avgPrepTime} minutes.`,
      };
    }
  }

  // Kitchen bottlenecks
  if (prompt.includes("bottleneck") || prompt.includes("slowest station") || prompt.includes("kitchen issue")) {
    if (dataSummaries.orders?.bottlenecks && dataSummaries.orders.bottlenecks.length > 0) {
      const bottlenecks = dataSummaries.orders.bottlenecks.slice(0, 3);
      const bottleneckList = bottlenecks
        .map((b) => `• ${b.station}: avg ${b.avgWaitTime} min (${b.ticketCount} tickets)`)
        .join("\n");
      return {
        matched: true,
        answer: `Kitchen bottlenecks (slowest stations):\n${bottleneckList}`,
      };
    }
  }

  // ========== ADDITIONAL ANALYTICS QUERIES ==========

  // Average order value
  if (prompt.includes("average order") || prompt.includes("avg order") || prompt.includes("order value")) {
    if (dataSummaries.analytics) {
      return {
        matched: true,
        answer: `Average order value: Today £${dataSummaries.analytics.today.avgOrderValue.toFixed(2)}, This week £${dataSummaries.analytics.thisWeek.avgOrderValue.toFixed(2)}, This month £${dataSummaries.analytics.thisMonth.avgOrderValue.toFixed(2)}.`,
      };
    }
  }

  // Payment methods
  if (prompt.includes("payment method") || prompt.includes("how do customer") || prompt.includes("card vs cash")) {
    if (dataSummaries.analytics?.paymentMethods) {
      const methods = Object.entries(dataSummaries.analytics.paymentMethods)
        .map(([method, data]) => `• ${method}: ${data.count} orders (£${data.revenue.toFixed(2)})`)
        .join("\n");
      return {
        matched: true,
        answer: `Payment methods breakdown:\n${methods}`,
      };
    }
  }

  // Poorly selling / never ordered items
  if (
    prompt.includes("poorly selling") ||
    prompt.includes("not selling") ||
    prompt.includes("never ordered") ||
    prompt.includes("worst seller") ||
    prompt.includes("slow seller")
  ) {
    if (dataSummaries.analytics?.itemPerformance) {
      const neverOrdered = dataSummaries.analytics.itemPerformance.neverOrdered.slice(0, 5);
      const rarelyOrdered = dataSummaries.analytics.itemPerformance.rarelyOrdered.slice(0, 5);
      
      let answer = "";
      if (neverOrdered.length > 0) {
        answer += `Never ordered (last 7 days): ${neverOrdered.join(", ")}`;
      }
      if (rarelyOrdered.length > 0) {
        if (answer) answer += "\n\n";
        answer += `Rarely ordered: ${rarelyOrdered.map((i) => `${i.name} (${i.count} orders)`).join(", ")}`;
      }
      if (!answer) {
        answer = "All your menu items have been selling well! No underperformers detected.";
      }
      return { matched: true, answer };
    }
  }

  // Monthly revenue
  if (
    (prompt.includes("revenue") || prompt.includes("sales")) &&
    (prompt.includes("this month") || prompt.includes("month"))
  ) {
    if (dataSummaries.analytics) {
      const thisMonth = dataSummaries.analytics.thisMonth;
      return {
        matched: true,
        answer: `This month's revenue is £${thisMonth.revenue.toFixed(2)} from ${thisMonth.orders} orders (avg £${thisMonth.avgOrderValue.toFixed(2)} per order).`,
      };
    }
  }

  // Dine-in vs takeaway
  if (
    prompt.includes("dine in") ||
    prompt.includes("dine-in") ||
    prompt.includes("takeaway") ||
    prompt.includes("take away") ||
    prompt.includes("delivery")
  ) {
    if (dataSummaries.analytics?.orderPatterns) {
      const patterns = dataSummaries.analytics.orderPatterns;
      const total = patterns.takeawayVsDineIn.takeaway + patterns.takeawayVsDineIn.dineIn;
      const takeawayPct = total > 0 ? ((patterns.takeawayVsDineIn.takeaway / total) * 100).toFixed(1) : 0;
      const dineInPct = total > 0 ? ((patterns.takeawayVsDineIn.dineIn / total) * 100).toFixed(1) : 0;
      return {
        matched: true,
        answer: `Order breakdown: ${patterns.takeawayVsDineIn.dineIn} dine-in (${dineInPct}%) vs ${patterns.takeawayVsDineIn.takeaway} takeaway (${takeawayPct}%). Average items per order: ${patterns.avgItemsPerOrder.toFixed(1)}.`,
      };
    }
  }

  // Table metrics / turnover
  if (prompt.includes("table turnover") || prompt.includes("table metric") || prompt.includes("table performance")) {
    if (dataSummaries.analytics?.tableMetrics) {
      const metrics = dataSummaries.analytics.tableMetrics;
      const topTables = metrics.revenueByTable.slice(0, 3)
        .map((t) => `Table ${t.tableNumber}: £${t.revenue.toFixed(2)} (${t.sessions} sessions)`)
        .join(", ");
      return {
        matched: true,
        answer: `Table metrics: ${metrics.totalSessions} sessions total, avg turnover ${metrics.avgTurnoverTime.toFixed(0)} minutes. Top tables by revenue: ${topTables}.`,
      };
    }
  }

  // Category performance
  if (prompt.includes("category performance") || prompt.includes("best category") || prompt.includes("top category")) {
    if (dataSummaries.analytics?.trending?.categoryPerformance) {
      const catPerf = Object.entries(dataSummaries.analytics.trending.categoryPerformance)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([cat, data]) => `• ${cat}: £${data.revenue.toFixed(2)} (${data.orders} orders)`)
        .join("\n");
      return {
        matched: true,
        answer: `Category performance (by revenue):\n${catPerf}`,
      };
    }
  }

  // Summary / overview / how's business
  if (
    prompt.includes("summary") ||
    prompt.includes("overview") ||
    prompt.includes("how's business") ||
    prompt.includes("how is business") ||
    prompt.includes("business doing")
  ) {
    if (dataSummaries.analytics && dataSummaries.menu) {
      const today = dataSummaries.analytics.today;
      const growth = dataSummaries.analytics.growth;
      const revTrend = growth.revenueGrowth >= 0 ? "📈" : "📉";
      const menu = dataSummaries.menu;
      
      return {
        matched: true,
        answer: `📊 Business Overview:\n\n` +
          `💰 Today: £${today.revenue.toFixed(2)} from ${today.orders} orders\n` +
          `${revTrend} Week trend: Revenue ${growth.revenueGrowth >= 0 ? "+" : ""}${growth.revenueGrowth.toFixed(1)}%, Orders ${growth.ordersGrowth >= 0 ? "+" : ""}${growth.ordersGrowth.toFixed(1)}%\n` +
          `🍽️ Menu: ${menu.totalItems} items across ${menu.categories.length} categories\n` +
          `⏰ Busiest day: ${dataSummaries.analytics.timeAnalysis.busiestDay}\n` +
          (dataSummaries.orders ? `📦 Live orders: ${dataSummaries.orders.liveOrders}` : ""),
      };
    }
  }

  // Help / what can you do
  if (
    prompt.includes("help") ||
    prompt.includes("what can you do") ||
    prompt.includes("what can you help") ||
    prompt.includes("capabilities")
  ) {
    return {
      matched: true,
      answer: `I'm your Servio AI Assistant! Here's what I can help you with:\n\n` +
        `📋 **Menu Management**\n` +
        `• Create, update, or delete menu items\n` +
        `• Update prices (e.g., "increase coffee prices by 10%")\n` +
        `• Translate menus to 9 languages\n` +
        `• Find items without images\n\n` +
        `📊 **Analytics & Insights**\n` +
        `• Revenue and order statistics\n` +
        `• Top selling items and categories\n` +
        `• Peak hours and busiest days\n` +
        `• Business performance trends\n\n` +
        `📱 **QR Codes**\n` +
        `• Generate QR codes for tables (e.g., "Table 5")\n` +
        `• Bulk generate QR codes (e.g., "tables 1-20")\n` +
        `• Counter QR codes for takeaway\n\n` +
        `📦 **Orders & Kitchen**\n` +
        `• View pending and overdue orders\n` +
        `• Update order statuses\n` +
        `• Kitchen station performance\n\n` +
        `📦 **Inventory**\n` +
        `• Check stock levels and low stock alerts\n` +
        `• Adjust inventory quantities\n` +
        `• Generate purchase orders\n\n` +
        `👥 **Staff & Tables**\n` +
        `• List and invite staff members\n` +
        `• View table availability and revenue\n\n` +
        `Just ask me anything in natural language!`,
    };
  }

  return { matched: false };
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
    const firstEntry = entries[0];
    if (entries.length > 0 && firstEntry && typeof firstEntry[1] === "object") {
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

  // "show" is context-dependent - if followed by "me" or asking to display data, it's not an action
  const hasAction = actionWords.some((word) => prompt.includes(word));
  
  // Check for "show" specifically - only treat as action if it's "show/hide" toggle context
  const hasShowAction = prompt.includes("show") && 
    (prompt.includes("hide") || prompt.includes("toggle") || prompt.includes("availability"));

  if (hasAction || hasShowAction) {
    return { canAnswer: false, confidence: 1.0 };
  }

  // Step 2: Try direct pattern matching for common queries (fast, no LLM call needed)
  const directMatch = tryDirectPatternMatch(userPrompt, dataSummaries);
  if (directMatch.matched && directMatch.answer) {
    return {
      canAnswer: true,
      answer: directMatch.answer,
      confidence: 1.0, // Direct pattern match is 100% confident
    };
  }

  // Step 3: Build data structure summary for LLM classifier fallback
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

  // Step 4: Use LLM classifier as fallback for complex queries
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

    const firstChoice = response.choices[0];
    if (!firstChoice) {
      throw new Error("No response from OpenAI");
    }
    const result = JSON.parse(firstChoice.message.content || "{}");

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

    // Graceful degradation - proceed to full planner
    return { canAnswer: false, confidence: 0 };
  }
}

// Check for conversational inputs that should return direct responses
function checkConversationalInput(userPrompt: string): { isConversational: boolean; response?: string } {
  const prompt = userPrompt.toLowerCase().trim();

  // Greetings
  if (prompt.match(/^(hi|hello|hey|good\s+(morning|afternoon|evening)|greetings?|howdy|yo)/)) {
    return {
      isConversational: true,
      response: "Hello! How can I help you with your hospitality business today?"
    };
  }

  // Thanks
  if (prompt.match(/^(thanks?|thank\s+you|thx|ty)/)) {
    return {
      isConversational: true,
      response: "You're welcome! Is there anything else I can help you with?"
    };
  }

  // How are you
  if (prompt.match(/^(how\s+(are|r)\s+you|how'?s\s+it\s+going|what'?s\s+up)/)) {
    return {
      isConversational: true,
      response: "I'm doing well, thank you! I'm here and ready to help you with your hospitality operations. What would you like to work on?"
    };
  }

  // About yourself
  if (prompt.match(/^(what\s+(are|r)\s+you|who\s+are\s+you|what\s+(do|can)\s+you\s+do)/)) {
    return {
      isConversational: true,
      response: "I'm Servio Assistant, your AI helper for hospitality operations. I can help you manage menus, track orders, handle inventory, generate QR codes, manage staff, and analyze your business data. What would you like to work on?"
    };
  }

  return { isConversational: false };
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
  // Check for conversational inputs first
  const conversational = checkConversationalInput(userPrompt);
  if (conversational.isConversational) {
    return {
      intent: userPrompt,
      tools: [],
      reasoning: "Handled conversational input directly",
      warnings: null,
      directAnswer: conversational.response,
    };
  }

  // Try intelligent fast-path (LLM-based classification for read-only queries)
  const fastPath = await tryFastPath(userPrompt, dataSummaries);
  if (fastPath.canAnswer && fastPath.confidence >= 0.85) {

    return {
      intent: userPrompt,
      tools: [],
      reasoning: `Answered directly from data summaries (confidence: ${(fastPath.confidence * 100).toFixed(0)}%)`,
      warnings: null,
      directAnswer: fastPath.answer,
    };
  }

  // Otherwise, use LLM planner for complex queries

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
    const firstChoice = completion.choices[0];
    if (!firstChoice) {
      throw new Error("No response from OpenAI");
    }
    const message = firstChoice.message;

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

        const firstChoice = completion.choices[0];
        if (!firstChoice) {
          throw new Error("No response from OpenAI");
        }
        const message = firstChoice.message;
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

        // Re-throw the fallback error
        if (fallbackError instanceof z.ZodError) { /* Condition handled */ }
        throw fallbackError;
      }
    }

    // If original error wasn't from mini, or fallback also failed
    if (_error instanceof z.ZodError) { /* Condition handled */ }
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

    const firstChoice = completion.choices[0];
    if (!firstChoice) {
      return "Action explanation unavailable.";
    }
    return firstChoice.message.content || "Action explanation unavailable.";
  } catch (_error) {

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

    const firstChoice = completion.choices[0];
    if (!firstChoice) {
      throw new Error("No response from OpenAI");
    }
    const response = JSON.parse(firstChoice.message.content || "{ /* Empty */ }");
    return response.suggestions || [];
  } catch (_error) {

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

    const firstChoice = response.choices[0];
    if (!firstChoice) {
      return "New Chat";
    }
    const title = firstChoice.message.content?.trim() || "New Chat";
    return title.substring(0, 60); // Limit length
  } catch (error) {

    return firstUserMessage.substring(0, 60);
  }
}

// Export model constants for use in other modules
export { MODEL_MINI, MODEL_FULL };
