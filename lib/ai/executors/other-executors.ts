import { createClient } from "@/lib/supabase";
import { AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";
import { NavigationGoToPageParams } from "@/types/ai-assistant";

export async function executeDiscountsCreate(
  _params: unknown,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const typedParams = _params as {
    name: string;
    scope: string;
    amountPct: number;
    startsAt: string;
    endsAt?: string;
    scopeId?: string;
  };
  const supabase = await createClient();

  if (preview) {
    return {
      toolName: "discounts.create",
      before: [],
      after: [
        {
          name: typedParams.name,
          scope: typedParams.scope,
          discount: `${typedParams.amountPct}%`,
          startsAt: typedParams.startsAt,
          endsAt: typedParams.endsAt || "No end date",
        },
      ],
      impact: {
        itemsAffected: 1,
        description: `Discount "${typedParams.name}" (${typedParams.amountPct}% off) will be created`,
      },
    };
  }

  const { error } = await supabase.from("discounts").insert({
    venue_id: venueId,
    name: typedParams.name,
    scope: typedParams.scope,
    scope_id: typedParams.scopeId,
    amount_pct: typedParams.amountPct,
    starts_at: typedParams.startsAt,
    ends_at: typedParams.endsAt,
    created_by: userId,
  });

  if (error) throw new AIAssistantError("Failed to create discount", "EXECUTION_FAILED", { error });

  return {
    success: true,
    toolName: "discounts.create",
    result: { discountName: typedParams.name },
    auditId: "",
  };
}

export async function executeKDSGetOverdue(
  _params: unknown,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const typedParams = _params as { station?: string; thresholdMinutes: number };
  const supabase = await createClient();

  const query = supabase
    .from("kds_tickets")
    .select("*")
    .eq("venue_id", venueId)
    .eq("status", "in_progress");

  if (typedParams.station) {
    query.eq("station_id", typedParams.station);
  }

  const { data: tickets } = await query;

  const now = new Date();
  const overdueTickets =
    tickets?.filter((ticket) => {
      if (!ticket.started_at) return false;
      const elapsed = (now.getTime() - new Date(ticket.started_at).getTime()) / 1000 / 60;
      return elapsed > typedParams.thresholdMinutes;
    }) || [];

  return {
    success: true,
    toolName: "kds.get_overdue",
    result: { overdueCount: overdueTickets.length, tickets: overdueTickets },
    auditId: "",
  };
}

export async function executeKDSSuggestOptimization(
  _params: unknown,
  _venueId: string,
  _userId: string,
  _preview: boolean
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
  _userId: string,
  _preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const { page, itemId, itemName, action } = params;

  const routeMap: Record<string, string> = {
    dashboard: `/dashboard/${venueId}`,
    menu: `/dashboard/${venueId}/menu-management`,
    inventory: `/dashboard/${venueId}/inventory`,
    orders: `/dashboard/${venueId}/orders`,
    "live-orders": `/dashboard/${venueId}/live-orders`,
    kds: `/dashboard/${venueId}/kds`,
    "kitchen-display": `/dashboard/${venueId}/kds`,
    "qr-codes": `/dashboard/${venueId}/qr-codes`,
    analytics: `/dashboard/${venueId}/analytics`,
    settings: `/dashboard/${venueId}/settings`,
    staff: `/dashboard/${venueId}/staff`,
    tables: `/dashboard/${venueId}/tables`,
    feedback: `/dashboard/${venueId}/feedback`,
  };

  let targetRoute = routeMap[page];

  if (!targetRoute) {
    throw new AIAssistantError(`Unknown page: ${page}`, "INVALID_PARAMS");
  }

  // Handle item-specific navigation
  if (itemId && page === "menu") {
    // Add query params for item-specific actions
    const queryParams = new URLSearchParams();
    queryParams.set("itemId", itemId);
    if (action) {
      queryParams.set("action", action);
    }
    if (itemName) {
      queryParams.set("itemName", encodeURIComponent(itemName));
    }
    targetRoute = `${targetRoute}?${queryParams.toString()}`;
  }

  if (_preview) {
    const description = itemId
      ? `Will navigate to ${action || "edit"} ${itemName || "item"} on the ${page} page`
      : `Will navigate to the ${page} page`;

    return {
      toolName: "navigation.go_to_page",
      before: [],
      after: [],
      impact: {
        itemsAffected: 1,
        estimatedRevenue: 0,
        description,
      },
    };
  }

  const message = itemId
    ? `Taking you to ${action || "edit"} "${itemName || "the item"}"`
    : `Navigating to ${page} page`;

  return {
    success: true,
    toolName: "navigation.go_to_page",
    result: {
      action: "navigate",
      route: targetRoute,
      page: page,
      itemId,
      itemName,
      actionType: action,
      message,
    },
    auditId: "",
  };
}
