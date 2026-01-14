import MenuManagementClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createAdminClient } from "@/lib/supabase";

// Force dynamic rendering to prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Fetch initial menu items to prevent flickering "0 menu items"
  let initialMenuItems: {
    id: string;
    venue_id: string;
    name: string;
    description: string | null;
    price: number;
    category: string;
    image_url?: string | null;
    is_available: boolean;
    created_at: string;
    position?: number;
  }[] | undefined = undefined;

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createAdminClient();
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      const { data: menuItems, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .order("category")
        .order("position");

      if (!error && menuItems) {
        initialMenuItems = menuItems;
      }
    }
  } catch (error) {
    // Continue without initial data - client will load it
  }

  return (
    <MenuManagementClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
      initialMenuItems={initialMenuItems}
    />
  );
}
