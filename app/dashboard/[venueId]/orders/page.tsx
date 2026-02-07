import OrdersClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createAdminClient } from "@/lib/supabase";
import { todayWindowForLocal } from "@/lib/time";

interface OrderData {
  id: string;
  venue_id: string;
  table_number: number | null;
  table_id?: string | null;
  session_id?: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  items: Array<{
    menu_item_id: string;
    item_name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
  }>;
  total_amount: number;
  created_at: string;
  updated_at?: string;
  order_status:
    | "PLACED"
    | "ACCEPTED"
    | "IN_PREP"
    | "READY"
    | "OUT_FOR_DELIVERY"
    | "SERVING"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED"
    | "EXPIRED";
  payment_status?: string;
  payment_method?: string;
  notes?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  source?: "qr" | "counter";
  table_label?: string;
  counter_label?: string;
  table?: { is_configured: boolean } | null;
}

export default async function OrdersPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Fetch initial orders on server for instant load (no flicker)
  let initialOrders: OrderData[] = [];
  let initialStats: { todayOrders: number; revenue: number } | undefined;

  try {
    const supabase = createAdminClient();

    // Get today's time window using device local time
    const todayWindowData = todayWindowForLocal();
    const todayStart = todayWindowData.startUtcISO || new Date().toISOString();

    // Fetch all orders for this venue
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(100); // Limit to 100 most recent orders

    if (!error && orders && orders.length > 0) {
      initialOrders = orders as unknown as OrderData[];

      // Calculate stats
      const todayOrders = orders.filter(
        (order) => new Date(order.created_at) >= new Date(todayStart)
      );
      initialStats = {
        todayOrders: todayOrders.length,
        revenue: todayOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
      };
    }
  } catch {
    // Continue without initial data - client will load it
  }

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: !!auth,
    userId: auth?.user?.id,
    email: auth?.user?.email,
    tier: auth?.tier ?? "starter",
    role: auth?.role ?? "viewer",
    venueId: auth?.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "Orders",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <OrdersClientPage
        venueId={venueId}
        tier={auth?.tier ?? "starter"}
        role={auth?.role ?? "viewer"}
        initialOrders={initialOrders}
        initialStats={initialStats}
      />
    </>
  );
}
