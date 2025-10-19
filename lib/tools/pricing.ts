// Pricing Tools - Discount and pricing management
// Extracted from tool-executors.ts

import { createClient } from "@/lib/supabase/server";
import { AIAssistantError, AIPreviewDiff, AIExecutionResult } from "@/types/ai-assistant";

// ============================================================================
// Discount Tools
// ============================================================================

export async function executeDiscountsCreate(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  if (preview) {
    return {
      toolName: "discounts.create",
      before: [],
      after: [{
        name: params.name,
        scope: params.scope,
        discount: `${params.amountPct}%`,
        startsAt: params.startsAt,
        endsAt: params.endsAt || "No end date",
      }],
      impact: {
        itemsAffected: 1,
        description: `Discount "${params.name}" (${params.amountPct}% off) will be created`,
      },
    };
  }

  const { error } = await supabase
    .from("discounts")
    .insert({
      venue_id: venueId,
      name: params.name,
      scope: params.scope,
      scope_id: params.scopeId,
      amount_pct: params.amountPct,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      created_by: userId,
    });

  if (error) throw new AIAssistantError("Failed to create discount", "EXECUTION_FAILED", error);

  return {
    success: true,
    toolName: "discounts.create",
    result: { discountName: params.name },
    auditId: "",
  };
}

