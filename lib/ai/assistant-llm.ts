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
// Response Schema for Structured Output
// ============================================================================

const AIToolCallSchema = z.object({
  name: z.enum([
    "menu.update_prices",
    "menu.toggle_availability",
    "menu.create_item",
    "menu.delete_item",
    "menu.translate",
    "inventory.adjust_stock",
    "inventory.set_par_levels",
    "inventory.generate_purchase_order",
    "orders.mark_served",
    "orders.complete",
    "analytics.get_insights",
    "analytics.get_stats",
    "analytics.export",
    "analytics.create_report",
    "discounts.create",
    "kds.get_overdue",
    "kds.suggest_optimization",
    "navigation.go_to_page",
  ] as const),
  params: z.record(z.string(), z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()),
    z.array(z.number()),
    z.array(z.boolean()),
    z.record(z.string(), z.string()),
    z.record(z.string(), z.number()),
    z.record(z.string(), z.boolean()),
  ])),
  preview: z.boolean(),
});

const AIPlanSchema = z.object({
  intent: z.string().describe("High-level description of what the user wants"),
  tools: z
    .array(AIToolCallSchema)
    .describe("Ordered list of tool calls to execute"),
  reasoning: z
    .string()
    .describe("Explanation of why this plan is safe and appropriate"),
  warnings: z
    .array(z.string())
    .nullable()
    .describe("Any warnings or considerations for the user"),
});

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
- Translate menu to different languages
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
1. ALWAYS set preview=true for destructive or bulk actions, preview=false for navigation
2. NEVER exceed guardrail limits (price changes, discounts)
3. RESPECT role and tier restrictions
4. Provide clear reasoning for your plan
5. Warn about potential impacts (revenue, operations)
6. If the request is unclear, ask for clarification in the warnings
7. If the request violates guardrails, explain why in warnings
8. Use ONLY the tools available; never hallucinate capabilities
9. When updating prices, preserve significant figures and round appropriately
10. For inventory, always validate units and quantities

OUTPUT FORMAT:
Return a structured plan with:
- intent: what the user wants
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
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: zodResponseFormat(AIPlanSchema, "assistant_plan"),
      temperature: 0.1, // Low temperature for consistent, safe outputs
    }) as any;

    // Handle parsed response (either from .parsed or by parsing content)
    let plan = completion.choices[0].message.parsed;
    
    if (!plan && completion.choices[0].message.content) {
      plan = JSON.parse(completion.choices[0].message.content);
    }

    if (!plan) {
      throw new Error("Failed to parse AI response");
    }

    // Validate each tool call against its schema
    const validatedTools = plan.tools.map((tool: any) => {
      const schema = TOOL_SCHEMAS[tool.name as ToolName];
      if (!schema) {
        throw new Error(`Unknown tool: ${tool.name}`);
      }

      // Validate params against schema
      const validatedParams = schema.parse(tool.params);

      return {
        ...tool,
        params: validatedParams,
      };
    });

    return {
      intent: plan.intent,
      tools: validatedTools,
      reasoning: plan.reasoning,
      warnings: plan.warnings,
    };
  } catch (error) {
    console.error("[AI ASSISTANT] Planning error:", error);
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

