// Navigation Tools - Navigation and routing
// Extracted from tool-executors.ts

import { NavigationGoToPageParams, AIAssistantError, AIPreviewDiff, AIExecutionResult } from "@/types/ai-assistant";

// ============================================================================
// Navigation Tools
// ============================================================================

export async function executeNavigationGoToPage(
  params: NavigationGoToPageParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const { page } = params;
  
  // Map page names to actual routes (verified against existing pages)
  const routeMap: Record<string, string> = {
    "dashboard": `/dashboard/${venueId}`,
    "menu": `/dashboard/${venueId}/menu-management`, // menu-management exists
    "inventory": `/dashboard/${venueId}/inventory`,
    "orders": `/dashboard/${venueId}/orders`,
    "live-orders": `/dashboard/${venueId}/live-orders`,
    "kds": `/dashboard/${venueId}/kds`,
    "kitchen-display": `/dashboard/${venueId}/kds`, // same as kds
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

  // Preview mode - just show what would happen
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

  // Execute - return navigation instruction
  return {
    success: true,
    toolName: "navigation.go_to_page",
    result: {
      action: "navigate",
      route: targetRoute,
      page: page,
      message: `Navigating to ${page} page`,
    },
    auditId: "", // Will be set by the calling function
  };
}

