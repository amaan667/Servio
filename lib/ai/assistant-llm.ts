// Servio AI Assistant - LLM Service
// Handles intent understanding, planning, and structured output generation

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { aiLogger as logger } from "@/lib/logger";
import { errorToContext } from "@/lib/utils/error-to-context";
import {
  AIAssistantContext,
  AIPlanResponse,
  ToolName,
  TOOL_SCHEMAS,
  MenuSummary,
  InventorySummary,
  OrdersSummary,
  AnalyticsSummary,
  DEFAULT_GUARDRAILS,
  AssistantPlanSchema,
} from "@/types/ai-assistant";

// Lazy initialize OpenAI client
let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
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
  "discounts.create", // Financial impact, needs precision
  "inventory.set_par_levels", // Complex calculations
  "analytics.create_report", // Complex aggregations
]);

// Define which tools are simple and work perfectly with mini
const SIMPLE_TOOLS = new Set<ToolName>([
  "navigation.go_to_page", // Simple routing
  "analytics.get_stats", // Direct queries
  "analytics.get_insights", // Direct queries
  "menu.toggle_availability", // Simple boolean toggle
  "orders.mark_served", // Simple status update
  "orders.complete", // Simple status update
  "kds.get_overdue", // Simple query
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
- Navigate to menu management pages
- Guide users to upload/edit images for menu items (navigate to edit page)

INVENTORY MANAGEMENT:
- Adjust stock levels and track ingredients
- Set par levels and generate purchase orders
- Navigate to inventory pages

ORDERS & KDS:
- Mark orders as served or complete
- Get overdue orders from kitchen display
- Suggest kitchen optimizations
- Navigate to orders and KDS pages

ANALYTICS & REPORTING:
- Get detailed statistics (revenue, orders, top items, peak hours)
- Create custom reports and exports
- Analyze menu performance
- Navigate to analytics pages

NAVIGATION:
- Take users to unknown page in the system
- Find specific features and sections

CONTEXT:
- User Role: ${userRole}
- Venue Tier: ${venueTier}
- Timezone: ${context.timezone}
- Features Enabled: ${JSON.stringify(features)}

CURRENT DATA SUMMARIES:
${dataSummaries.menu ? `\nMENU:\n${JSON.stringify(dataSummaries.menu, null, 2)}` : ""}
${dataSummaries.inventory ? `\nINVENTORY:\n${JSON.stringify(dataSummaries.inventory, null, 2)}` : ""}
${dataSummaries.orders ? `\nORDERS:\n${JSON.stringify(dataSummaries.orders, null, 2)}` : ""}
${dataSummaries.analytics ? `\nANALYTICS:\n${JSON.stringify(dataSummaries.analytics, null, 2)}` : ""}

AVAILABLE TOOLS:
${Object.entries(TOOL_SCHEMAS)
  .map(([name, schema]) => `- ${name}: ${schema.description || ""}`)
  .join("\n")}

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
- ${venueTier === "professional" ? "Professional tier: inventory enabled" : ""}
- ${venueTier === "premium" ? "Premium tier: all features enabled" : ""}

RULES:
1. ALWAYS set preview=true for destructive or bulk actions, preview=false for navigation and analytics queries
2. NEVER exceed guardrail limits (price changes, discounts)
3. RESPECT role and tier restrictions
4. Provide clear reasoning for your plan
5. Warn about potential impacts (revenue, operations)
6. If the request is unclear, ask for clarification in the warnings
7. If the request violates guardrails, explain why in warnings
8. Use ONLY the tools available; never hallucinate capabilities
9. When updating prices, preserve significant figures and round appropriately
10. For inventory, always validate units and quantities
11. IMPORTANT: Use the allItems array from MENU data to find item IDs when updating prices or availability
    - Search by item name (case-insensitive, partial matches OK for common items like "coffee", "latte", etc.)
    - Always include the exact UUID from allItems in your params
    - Calculate new prices based on current prices from allItems

NATURAL LANGUAGE UNDERSTANDING:
- Be flexible with user queries - understand context and intent
- For simple questions that can be answered directly from data summaries:
  * "how many categories are there" → provide direct answer from menu.categories count
  * "how many menu items" → provide direct answer from menu.totalItems count
  * "what categories do I have" → provide direct answer listing menu.categories
  * "total revenue today" → provide direct answer from analytics data if available
  * "how many orders today" → provide direct answer from orders data if available
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
- For navigation:
  * "take me to", "show me", "go to", "open" → use navigation.go_to_page
  * "add image to X", "upload image for X", "edit image for X" → use navigation.go_to_page with page="menu", itemId from allItems, action="upload_image"
  * Find the item ID from allItems array when user mentions item name
  * Use itemName param to include context in navigation message
- For translation:
  * ALWAYS check the target language carefully: "english" = "en", "spanish" = "es"
  * "translate to Spanish" → use menu.translate with targetLanguage="es"
  * "translate to English" or "translate back to English" or "translate back into english" → use menu.translate with targetLanguage="en"
  * "translate the full menu into english" → use menu.translate with targetLanguage="en"
  * "translate full menu into english" → use menu.translate with targetLanguage="en"
  * "translate to French" → use menu.translate with targetLanguage="fr"
  * "translate menu to [language]" → use menu.translate with appropriate language code
  * IMPORTANT: When user says "into English", "to English", "back to English", or "back into English", they want targetLanguage="en", NOT "es"
  * CRITICAL: If user mentions "english" in their request, use targetLanguage="en" (English), NOT "es" (Spanish)
  * DOUBLE-CHECK: Before calling menu.translate, verify that if the user wants "english", you use "en", not "es"
  * STEP-BY-STEP: 1) Read user request, 2) Identify target language, 3) Map to code: "english"→"en", "spanish"→"es", 4) Use correct code in tool call
  * Examples: 
    - "translate the full menu into english" → targetLanguage="en"
    - "translate full menu back into english" → targetLanguage="en"
    - "translate to english" → targetLanguage="en"
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

// Check if query can be answered directly from data summaries
function canAnswerDirectly(
  userPrompt: string,
  dataSummaries: {
    menu?: MenuSummary;
    inventory?: InventorySummary;
    orders?: OrdersSummary;
    analytics?: AnalyticsSummary;
  }
): { canAnswer: boolean; answer?: string } {
  const prompt = userPrompt.toLowerCase().trim();
  const analytics = dataSummaries.analytics;
  const menu = dataSummaries.menu;

  // ========== MENU QUESTIONS ==========
  if (prompt.includes("how many categories") || prompt.includes("number of categories")) {
    if (menu?.categories) {
      const count = menu.categories.length;
      return {
        canAnswer: true,
        answer: `You have ${count} menu categories: ${menu.categories.map((c) => c.name).join(", ")}`,
      };
    }
  }

  if (prompt.includes("how many menu items") || prompt.includes("total menu items")) {
    if (menu?.totalItems !== undefined) {
      return {
        canAnswer: true,
        answer: `You have ${menu.totalItems} menu items total`,
      };
    }
  }

  if (prompt.includes("what categories") || prompt.includes("list categories")) {
    if (menu?.categories && menu.categories.length > 0) {
      const categoriesList = menu.categories
        .map((c) => `- ${c.name} (${c.itemCount} items)`)
        .join("\n");
      return {
        canAnswer: true,
        answer: `Your menu categories:\n${categoriesList}`,
      };
    }
  }

  if (prompt.includes("items with images") || prompt.includes("image coverage")) {
    if (menu?.itemsWithImages !== undefined) {
      const total = menu.totalItems;
      const withImages = menu.itemsWithImages;
      const percentage = total > 0 ? ((withImages / total) * 100).toFixed(1) : 0;
      return {
        canAnswer: true,
        answer: `${withImages} out of ${total} items have images (${percentage}% coverage). ${menu.itemsWithoutImages} items are missing images.`,
      };
    }
  }

  if (prompt.includes("never ordered") || prompt.includes("items never sold")) {
    if (analytics?.itemPerformance?.neverOrdered) {
      const items = analytics.itemPerformance.neverOrdered;
      if (items.length === 0) {
        return {
          canAnswer: true,
          answer: "Great news! All your menu items have been ordered at least once.",
        };
      }
      return {
        canAnswer: true,
        answer: `${items.length} items haven't been ordered in the last 7 days:\n${items
          .slice(0, 10)
          .map((item) => `- ${item}`)
          .join("\n")}${items.length > 10 ? `\n...and ${items.length - 10} more` : ""}`,
      };
    }
  }

  // ========== REVENUE & PERFORMANCE QUESTIONS ==========
  if (prompt.includes("revenue today") || prompt.includes("today's revenue")) {
    if (analytics?.today) {
      return {
        canAnswer: true,
        answer: `Today's revenue is £${analytics.today.revenue.toFixed(2)} from ${analytics.today.orders} orders (avg £${analytics.today.avgOrderValue.toFixed(2)} per order)`,
      };
    }
  }

  if (
    prompt.includes("revenue this week") ||
    (prompt.includes("week") && prompt.includes("revenue"))
  ) {
    if (analytics?.thisWeek) {
      return {
        canAnswer: true,
        answer: `This week's revenue is £${analytics.thisWeek.revenue.toFixed(2)} from ${analytics.thisWeek.orders} orders (avg £${analytics.thisWeek.avgOrderValue.toFixed(2)} per order)`,
      };
    }
  }

  if (
    prompt.includes("revenue this month") ||
    (prompt.includes("month") && prompt.includes("revenue"))
  ) {
    if (analytics?.thisMonth) {
      return {
        canAnswer: true,
        answer: `This month's revenue is £${analytics.thisMonth.revenue.toFixed(2)} from ${analytics.thisMonth.orders} orders (avg £${analytics.thisMonth.avgOrderValue.toFixed(2)} per order)`,
      };
    }
  }

  if (prompt.includes("last 7 days") || prompt.includes("last week")) {
    if (analytics?.last7Days) {
      return {
        canAnswer: true,
        answer: `Last 7 days: £${analytics.last7Days.revenue.toFixed(2)} revenue from ${analytics.last7Days.orders} orders (avg £${analytics.last7Days.avgOrderValue.toFixed(2)} per order)`,
      };
    }
  }

  if (prompt.includes("last 30 days") || prompt.includes("last month")) {
    if (analytics?.last30Days) {
      return {
        canAnswer: true,
        answer: `Last 30 days: £${analytics.last30Days.revenue.toFixed(2)} revenue from ${analytics.last30Days.orders} orders (avg £${analytics.last30Days.avgOrderValue.toFixed(2)} per order)`,
      };
    }
  }

  // ========== GROWTH & COMPARISON QUESTIONS ==========
  if (prompt.includes("growth") || prompt.includes("compared to last week")) {
    if (analytics?.growth) {
      const revenueDir = analytics.growth.revenueGrowth > 0 ? "up" : "down";
      const ordersDir = analytics.growth.ordersGrowth > 0 ? "up" : "down";
      return {
        canAnswer: true,
        answer: `Revenue is ${revenueDir} ${Math.abs(analytics.growth.revenueGrowth).toFixed(1)}% and orders are ${ordersDir} ${Math.abs(analytics.growth.ordersGrowth).toFixed(1)}% compared to the previous week.`,
      };
    }
  }

  // ========== TOP SELLING ITEMS ==========
  if (
    prompt.includes("top selling") ||
    prompt.includes("best selling") ||
    prompt.includes("most popular") ||
    prompt.includes("top items")
  ) {
    if (analytics?.trending?.topItems && analytics.trending.topItems.length > 0) {
      const items = analytics.trending.topItems
        .map(
          (item, i) =>
            `${i + 1}. ${item.name} - ${item.count} sold, £${item.revenue.toFixed(2)} revenue`
        )
        .join("\n");
      return {
        canAnswer: true,
        answer: `Top selling items (last 7 days):\n${items}`,
      };
    }
  }

  if (prompt.includes("top by revenue") || prompt.includes("highest revenue items")) {
    if (
      analytics?.itemPerformance?.topByRevenue &&
      analytics.itemPerformance.topByRevenue.length > 0
    ) {
      const items = analytics.itemPerformance.topByRevenue
        .slice(0, 5)
        .map(
          (item, i) => `${i + 1}. ${item.name} - £${item.revenue.toFixed(2)} (${item.count} sold)`
        )
        .join("\n");
      return {
        canAnswer: true,
        answer: `Top items by revenue:\n${items}`,
      };
    }
  }

  // ========== TIME-BASED ANALYTICS ==========
  if (prompt.includes("busiest day") || prompt.includes("best day")) {
    if (analytics?.timeAnalysis?.busiestDay) {
      const day = analytics.timeAnalysis.byDayOfWeek.find(
        (d) => d.day === analytics.timeAnalysis.busiestDay
      );
      return {
        canAnswer: true,
        answer: `${analytics.timeAnalysis.busiestDay} is your busiest day with ${day?.orders || 0} orders and £${day?.revenue.toFixed(2) || 0} revenue on average.`,
      };
    }
  }

  if (prompt.includes("peak hours") || prompt.includes("busiest hours")) {
    if (analytics?.timeAnalysis?.peakHours && analytics.timeAnalysis.peakHours.length > 0) {
      const hours = analytics.timeAnalysis.peakHours
        .map((h) => `${h.hour}:00 (${h.orderCount} orders)`)
        .join(", ");
      return {
        canAnswer: true,
        answer: `Peak hours: ${hours}`,
      };
    }
  }

  if (prompt.includes("day of week") || prompt.includes("by day")) {
    if (analytics?.timeAnalysis?.byDayOfWeek) {
      const days = analytics.timeAnalysis.byDayOfWeek
        .map((d) => `${d.day}: ${d.orders} orders, £${d.revenue.toFixed(2)}`)
        .join("\n");
      return {
        canAnswer: true,
        answer: `Performance by day:\n${days}`,
      };
    }
  }

  // ========== CATEGORY PERFORMANCE ==========
  if (prompt.includes("category performance") || prompt.includes("categories revenue")) {
    if (analytics?.trending?.categoryPerformance) {
      const categories = Object.entries(analytics.trending.categoryPerformance)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(
          ([name, stats]) =>
            `- ${name}: £${stats.revenue.toFixed(2)} from ${stats.orders} orders (${stats.itemCount} items)`
        )
        .join("\n");
      return {
        canAnswer: true,
        answer: `Category performance (last 7 days):\n${categories}`,
      };
    }
  }

  // ========== PAYMENT METHODS ==========
  if (prompt.includes("payment methods") || prompt.includes("payment breakdown")) {
    if (analytics?.paymentMethods) {
      const methods = Object.entries(analytics.paymentMethods)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(
          ([method, stats]) => `- ${method}: ${stats.count} orders, £${stats.revenue.toFixed(2)}`
        )
        .join("\n");
      return {
        canAnswer: true,
        answer: `Payment methods:\n${methods}`,
      };
    }
  }

  // ========== ORDER PATTERNS ==========
  if (prompt.includes("average items per order") || prompt.includes("items per order")) {
    if (analytics?.orderPatterns?.avgItemsPerOrder) {
      return {
        canAnswer: true,
        answer: `Average items per order: ${analytics.orderPatterns.avgItemsPerOrder.toFixed(1)} items`,
      };
    }
  }

  if (prompt.includes("takeaway") || prompt.includes("dine in") || prompt.includes("delivery")) {
    if (analytics?.orderPatterns?.takeawayVsDineIn) {
      const { takeaway, dineIn } = analytics.orderPatterns.takeawayVsDineIn;
      const total = takeaway + dineIn;
      const takeawayPct = total > 0 ? ((takeaway / total) * 100).toFixed(1) : 0;
      const dineInPct = total > 0 ? ((dineIn / total) * 100).toFixed(1) : 0;
      return {
        canAnswer: true,
        answer: `Order types: ${takeaway} takeaway (${takeawayPct}%), ${dineIn} dine-in (${dineInPct}%)`,
      };
    }
  }

  // ========== TABLE METRICS ==========
  if (prompt.includes("table turnover") || prompt.includes("average table time")) {
    if (analytics?.tableMetrics?.avgTurnoverTime) {
      return {
        canAnswer: true,
        answer: `Average table turnover time: ${analytics.tableMetrics.avgTurnoverTime.toFixed(0)} minutes`,
      };
    }
  }

  if (prompt.includes("top tables") || prompt.includes("best tables")) {
    if (
      analytics?.tableMetrics?.revenueByTable &&
      analytics.tableMetrics.revenueByTable.length > 0
    ) {
      const tables = analytics.tableMetrics.revenueByTable
        .slice(0, 5)
        .map((t) => `Table ${t.tableNumber}: £${t.revenue.toFixed(2)} from ${t.sessions} sessions`)
        .join("\n");
      return {
        canAnswer: true,
        answer: `Top performing tables:\n${tables}`,
      };
    }
  }

  return { canAnswer: false };
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
  // Check if we can answer directly from data summaries
  const directAnswer = canAnswerDirectly(userPrompt, dataSummaries);
  if (directAnswer.canAnswer) {
    return {
      intent: userPrompt,
      tools: [],
      reasoning: "This question can be answered directly from the available data summaries.",
      warnings: null,
      directAnswer: directAnswer.answer,
    };
  }

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
