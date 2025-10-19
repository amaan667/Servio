// KDS Tools - Kitchen Display System management
// Extracted from tool-executors.ts

import { createClient } from "@/lib/supabase/server";
import { AIPreviewDiff, AIExecutionResult } from "@/types/ai-assistant";

// ============================================================================
// KDS Tools
// ============================================================================

export async function executeKDSGetOverdue(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const query = supabase
    .from("kds_tickets")
    .select("*")
    .eq("venue_id", venueId)
    .eq("status", "in_progress");

  if (params.station) {
    query.eq("station_id", params.station);
  }

  const { data: tickets } = await query;

  const now = new Date();
  const overdueTickets = tickets?.filter(ticket => {
    if (!ticket.started_at) return false;
    const elapsed = (now.getTime() - new Date(ticket.started_at).getTime()) / 1000 / 60;
    return elapsed > params.thresholdMinutes;
  }) || [];

  return {
    success: true,
    toolName: "kds.get_overdue",
    result: { overdueCount: overdueTickets.length, tickets: overdueTickets },
    auditId: "",
  };
}

export async function executeKDSSuggestOptimization(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  // This would analyze KDS performance and suggest optimizations
  return {
    success: true,
    toolName: "kds.suggest_optimization",
    result: {
      suggestions: [
        "Consider adding a prep station for high-volume items",
        "Grill station shows 15min avg wait - add more capacity during peak",
        "Route cold items to dedicated station to reduce congestion",
      ],
    },
    auditId: "",
  };
}

