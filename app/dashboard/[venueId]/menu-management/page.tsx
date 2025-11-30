import MenuManagementClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { fetchMenuItemCount } from "@/lib/counts/unified-counts";

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
    console.info(`[RAILWAY] Menu Management Server - Menu Items Count: ${initialMenuItemCount}`);
  } catch (error) {
    console.info(`[RAILWAY] Menu Management Server - Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return <MenuManagementClientPage venueId={venueId} initialMenuItemCount={initialMenuItemCount} />;
}
