import { createClient } from "@/lib/supabase";
import { AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";
import { NavigationGoToPageParams } from "@/types/ai-assistant";

export async function executeDiscountsCreate(

  };
  const supabase = await createClient();

  if (preview) {
    return {

          discount: `${typedParams.amountPct}%`,

        },
      ],

        description: `Discount "${typedParams.name}" (${typedParams.amountPct}% off) will be created`,
      },
    };
  }

  const { error } = await supabase.from("discounts").insert({

  if (error) throw new AIAssistantError("Failed to create discount", "EXECUTION_FAILED", { error });

  return {

    result: { discountName: typedParams.name },

  };
}

export async function executeKDSGetOverdue(

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

    result: { overdueCount: overdueTickets.length, tickets: overdueTickets },

  };
}

export async function executeKDSSuggestOptimization(

        "Grill station shows 15min avg wait - add more capacity during peak",
        "Route cold items to dedicated station to reduce congestion",
      ],
    },

  };
}

export async function executeNavigationGoToPage(

  const { page, itemId, itemName, action, table, counter, bulkPrefix, bulkCount, bulkType } = params;

  const routeMap: Record<string, string> = {
    dashboard: `/dashboard/${venueId}`,
    menu: `/dashboard/${venueId}/menu-management`,
    inventory: `/dashboard/${venueId}/inventory`,
    orders: `/dashboard/${venueId}/orders`,
    "live-orders": `/dashboard/${venueId}/live-orders`,
    kds: `/dashboard/${venueId}/kds`,
    "kitchen-display": `/dashboard/${venueId}/kds`,
    qr: `/dashboard/${venueId}/qr-codes`,
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

  // Handle QR code navigation with query params
  if (page === "qr" || page === "qr-codes") {
    const queryParams = new URLSearchParams();
    
    // Single QR code generation
    if (table) {
      queryParams.set("table", encodeURIComponent(table));
    }
    if (counter) {
      queryParams.set("counter", encodeURIComponent(counter));
    }
    
    // Bulk QR code generation
    if (bulkPrefix && bulkCount && bulkType) {
      queryParams.set("bulkPrefix", encodeURIComponent(bulkPrefix));
      queryParams.set("bulkCount", bulkCount.toString());
      queryParams.set("bulkType", bulkType);
    }
    
    if (queryParams.toString()) {
      targetRoute = `${targetRoute}?${queryParams.toString()}`;
    }
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

        description,
      },
    };
  }

  const message = itemId
    ? `Taking you to ${action || "edit"} "${itemName || "the item"}"`
    : `Navigating to ${page} page`;

  return {

      itemId,
      itemName,

      message,
    },

  };
}
