import PaymentsClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createAdminClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";
import { logger } from "@/lib/monitoring/structured-logger";

export interface PaymentTransaction {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  table_label: string | null;
  counter_label: string | null;
  total_amount: number;
  payment_status: string;
  payment_method: string | null;
  order_status: string;
  created_at: string;
  refunded_at: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
}

export interface PaymentStats {
  todayRevenue: number;
  pendingPayments: number;
  completedPayments: number;
  refundTotal: number;
  unpaidOrdersCount: number;
  paidOrdersCount: number;
}

async function fetchPaymentData(venueId: string): Promise<{
  transactions: PaymentTransaction[];
  stats: PaymentStats;
}> {
  const supabase = createAdminClient();
  const todayWindow = todayWindowForTZ("Europe/London");
  
  const todayStart = todayWindow.startUtcISO || new Date().toISOString();
  const todayEnd = todayWindow.endUtcISO || new Date().toISOString();

  try {
    // Fetch all orders for the venue
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[PaymentsPage] Failed to fetch orders", {
        venueId,
        error: error.message,
      });
      throw error;
    }

    const allOrders = orders || [];

    // Calculate statistics
    const todayPaidOrders = allOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      const isToday = orderDate >= new Date(todayStart) && orderDate < new Date(todayEnd);
      return isToday && order.payment_status === "PAID";
    });

    const pendingOrders = allOrders.filter((order) => {
      const orderDate = new Date(order.created_at);
      const isToday = orderDate >= new Date(todayStart) && orderDate < new Date(todayEnd);
      return isToday && order.payment_status === "UNPAID";
    });

    const refundedOrders = allOrders.filter(
      (order) =>
        order.payment_status === "REFUNDED" || order.payment_status === "PARTIALLY_REFUNDED"
    );

    const stats: PaymentStats = {
      todayRevenue: todayPaidOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
      pendingPayments: pendingOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
      completedPayments: todayPaidOrders.length,
      refundTotal: refundedOrders.reduce(
        (sum, order) => sum + (order.refund_amount || order.total_amount || 0),
        0
      ),
      unpaidOrdersCount: pendingOrders.length,
      paidOrdersCount: todayPaidOrders.length,
    };

    // Transform orders to PaymentTransaction format
    const transactions: PaymentTransaction[] = allOrders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      table_label: order.table_label,
      counter_label: order.counter_label,
      total_amount: order.total_amount,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      order_status: order.order_status,
      created_at: order.created_at,
      refunded_at: order.refunded_at,
      refund_amount: order.refund_amount,
      refund_reason: order.refund_reason,
    }));

    logger.info("[PaymentsPage] Successfully fetched payment data", {
      venueId,
      transactionCount: transactions.length,
      stats,
    });

    return { transactions, stats };
  } catch (error) {
    logger.error("[PaymentsPage] Error fetching payment data", {
      venueId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Return empty data on error
    return {
      transactions: [],
      stats: {
        todayRevenue: 0,
        pendingPayments: 0,
        completedPayments: 0,
        refundTotal: 0,
        unpaidOrdersCount: 0,
        paidOrdersCount: 0,
      },
    };
  }
}

export default async function PaymentsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: !!auth,
    userId: auth?.user?.id,
    email: auth?.user?.email,
    tier: auth?.tier ?? "starter",
    role: auth?.role ?? "viewer",
    venueId: auth?.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "Payments",
  };

  // Fetch payment data on server
  const { transactions, stats } = await fetchPaymentData(venueId);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <PaymentsClientPage
        venueId={venueId}
        tier={auth?.tier ?? "starter"}
        role={auth?.role ?? "viewer"}
        initialTransactions={transactions}
        initialStats={stats}
      />
    </>
  );
}
