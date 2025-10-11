// Servio AI Assistant - LLM Service
// Handles intent understanding, planning, and structured output generation

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
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

// Model to use (GPT-4o per user preference)
const MODEL = "gpt-4o-2024-08-06"; // [[memory:5998613]]

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
- Take users to any page in the system
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
    if (rules.maxDiscountPercent)
      constraints.push(`max discount ${rules.maxDiscountPercent}%`);
    if (rules.maxBulkOperationSize)
      constraints.push(`max ${rules.maxBulkOperationSize} items per call`);
    if (rules.requiresManagerApproval)
      constraints.push("requires manager approval");
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
- For analytics queries (revenue, sales, stats):
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
  * "translate to Spanish" → use menu.translate with targetLanguage="es"
  * "translate to English" or "translate back to English" → use menu.translate with targetLanguage="en"
  * "translate to French" → use menu.translate with targetLanguage="fr"
  * "translate menu to [language]" → use menu.translate with appropriate language code
- Be intelligent about partial matches and synonyms

OUTPUT FORMAT:
Return a structured plan with:
- intent: what the user wants (clear, natural language)
- tools: ordered array of tool calls with exact params
- reasoning: why this plan is safe and appropriate
- warnings: any caveats or considerations (null if none)`;
}

// ============================================================================
// Planning Function
// ============================================================================

export async function planAssistantAction(
  userPrompt: string,
  context: AIAssistantContext,
  dataSummaries: {
    menu?: MenuSummary;
    inventory?: InventorySummary;
    orders?: OrdersSummary;
    analytics?: AnalyticsSummary;
  }
): Promise<AIPlanResponse> {
  const systemPrompt = buildSystemPrompt(context, dataSummaries);

  try {
    // Use zodResponseFormat with strict discriminated union schema
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL,
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
    // Type assertion needed as TypeScript doesn't know about the parsed property
    const parsed = (message as any).parsed;
    
    if (parsed) {
      // Response was successfully parsed and validated by zodResponseFormat
      return {
        intent: parsed.intent,
        tools: parsed.tools,
        reasoning: parsed.reasoning,
        warnings: parsed.warnings,
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
      };
    }
    
    throw new Error("Failed to parse AI response: no parsed or content available");
  } catch (error) {
    console.error("[AI ASSISTANT] Planning error:", error);
    if (error instanceof z.ZodError) {
      console.error("[AI ASSISTANT] Zod validation errors:", JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}

// ============================================================================
// Explain Action Function (for user clarity)
// ============================================================================

export async function explainAction(
  toolName: ToolName,
  params: any,
  context: AIAssistantContext
): Promise<string> {
  const systemPrompt = `You are Servio Assistant. Explain the following action in simple, human terms.
Be concise (1-2 sentences). Focus on what will change and potential impact.`;

  const userPrompt = `Explain this action:
Tool: ${toolName}
Parameters: ${JSON.stringify(params, null, 2)}
User Role: ${context.userRole}`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 150,
    });

    return completion.choices[0].message.content || "Action explanation unavailable.";
  } catch (error) {
    console.error("[AI ASSISTANT] Explanation error:", error);
    return "Unable to generate explanation.";
  }
}

// ============================================================================
// Suggestion Generator (for contextual prompts)
// ============================================================================

export async function generateSuggestions(
  pageContext: "menu" | "inventory" | "kds" | "orders" | "analytics",
  dataSummary: any
): Promise<string[]> {
  const systemPrompt = `Generate 3-4 actionable suggestions for a ${pageContext} dashboard.
Return ONLY a JSON array of strings. Each suggestion should be a natural language command.
Focus on common tasks, optimizations, or insights based on the data.`;

  const userPrompt = `Data: ${JSON.stringify(dataSummary, null, 2)}`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 200,
    });

    const response = JSON.parse(completion.choices[0].message.content || "{}");
    return response.suggestions || [];
  } catch (error) {
    console.error("[AI ASSISTANT] Suggestion generation error:", error);
    return [];
  }
}

// ============================================================================
// Token Usage Tracking
// ============================================================================

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number
): number {
  // GPT-4o pricing (as of 2024)
  const inputCostPer1k = 0.0025;
  const outputCostPer1k = 0.01;

  return (
    (inputTokens / 1000) * inputCostPer1k +
    (outputTokens / 1000) * outputCostPer1k
  );
}

