import { errorToContext } from "@/lib/utils/error-to-context";

// Servio AI Assistant - LLM Service
// Handles intent understanding, planning, and structured output generation

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { aiLogger as logger } from "@/lib/logger";
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

  // Category count questions
  if (prompt.includes("how many categories") || prompt.includes("number of categories")) {
    if (dataSummaries.menu?.categories) {
      const count = dataSummaries.menu.categories.length;
      return {
        canAnswer: true,
        answer: `You have ${count} menu categories: ${dataSummaries.menu.categories.map((c) => c.name).join(", ")}`,
      };
    }
  }

  // Total menu items count
  if (
    prompt.includes("how many menu items") ||
    prompt.includes("total menu items") ||
    prompt.includes("how many items")
  ) {
    if (dataSummaries.menu?.totalItems !== undefined) {
      return {
        canAnswer: true,
        answer: `You have ${dataSummaries.menu.totalItems} menu items total`,
      };
    }
  }

  // Categories list
  if (
    prompt.includes("what categories") ||
    prompt.includes("list categories") ||
    prompt.includes("categories")
  ) {
    if (dataSummaries.menu?.categories && dataSummaries.menu.categories.length > 0) {
      const categoriesList = dataSummaries.menu.categories
        .map((c) => `- ${c.name} (${c.itemCount} items)`)
        .join("\n");
      return {
        canAnswer: true,
        answer: `Your menu categories:\n${categoriesList}`,
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

// Export model constants for use in other modules
export { MODEL_MINI, MODEL_FULL };
