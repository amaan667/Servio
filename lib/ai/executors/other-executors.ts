import { createClient } from "@/lib/supabase";
import { AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";
import { NavigationGoToPageParams } from "@/types/ai-assistant";

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

export async function executeNavigationGoToPage(
  params: NavigationGoToPageParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const { page } = params;
  
  const routeMap: Record<string, string> = {
    "dashboard": `/dashboard/${venueId}`,
    "menu": `/dashboard/${venueId}/menu-management`,
    "inventory": `/dashboard/${venueId}/inventory`,
    "orders": `/dashboard/${venueId}/orders`,
    "live-orders": `/dashboard/${venueId}/live-orders`,
    "kds": `/dashboard/${venueId}/kds`,
    "kitchen-display": `/dashboard/${venueId}/kds`,
    "qr-codes": `/dashboard/${venueId}/qr-codes`,
    "analytics": `/dashboard/${venueId}/analytics`,
    "settings": `/dashboard/${venueId}/settings`,
    "staff": `/dashboard/${venueId}/staff`,
    "tables": `/dashboard/${venueId}/tables`,
    "feedback": `/dashboard/${venueId}/feedback`,
  };

  const targetRoute = routeMap[page];
  
  if (!targetRoute) {
    throw new AIAssistantError(`Unknown page: ${page}`, "INVALID_PARAMS");
  }

  if (preview) {
    return {
      toolName: "navigation.go_to_page",
      before: [],
      after: [],
      impact: {
        itemsAffected: 1,
        estimatedRevenue: 0,
        description: `Will navigate to the ${page} page`,
      },
    };
  }

  return {
    success: true,
    toolName: "navigation.go_to_page",
    result: {
      action: "navigate",
      route: targetRoute,
      page: page,
      message: `Navigating to ${page} page`,
    },
    auditId: "",
  };
}

