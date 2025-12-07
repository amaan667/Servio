import MenuManagementClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { fetchMenuItemCount } from "@/lib/counts/unified-counts";
import { logger } from "@/lib/logger";

// Force dynamic rendering to prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function MenuManagementPage({
  params,
}: {
  params: { venueId: string };
}) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Use unified count function - single source of truth
  let initialMenuItemCount = 0;
  try {
    initialMenuItemCount = await fetchMenuItemCount(venueId);
  } catch (error) {
    logger.error("[MENU MANAGEMENT] Error fetching menu item count", {
      error: error instanceof Error ? error.message : String(error),
      venueId,
    });
  }

  return <MenuManagementClientPage venueId={venueId} initialMenuItemCount={initialMenuItemCount} />;
}
