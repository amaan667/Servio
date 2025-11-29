import MenuManagementClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createAdminClient } from "@/lib/supabase";

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

  // Fetch menu item count using EXACT same query as dashboard
  // This ensures consistency between dashboard and menu management
  let initialMenuItemCount = 0;
  try {
    const supabase = createAdminClient();
    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
    
    // Use EXACT same query as dashboard for consistency
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("venue_id", normalizedVenueId)
      .order("created_at", { ascending: false }); // Same ordering as dashboard
    
    if (!menuError && menuItems) {
      initialMenuItemCount = menuItems.length;
    }
    
    // Log for Railway
    process.stdout.write(`\n[RAILWAY] Menu Management Server - Menu Items Count: ${initialMenuItemCount}\n`);
    process.stdout.write(`[RAILWAY] Menu Management Server - Venue ID: ${normalizedVenueId}\n`);
    console.error("[RAILWAY] Menu Management Server - Count:", initialMenuItemCount);
  } catch (error) {
    process.stdout.write(`\n[RAILWAY] Menu Management Server - Error fetching count: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  return <MenuManagementClientPage venueId={venueId} initialMenuItemCount={initialMenuItemCount} />;
}
