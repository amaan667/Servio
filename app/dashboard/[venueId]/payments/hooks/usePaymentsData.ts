import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";

interface PaymentOrder {
  id: string;
  order_number?: string;
  table_number?: number | string | null;
  table_label?: string;
  counter_label?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount?: number;
  payment_status?: string;
  payment_method?: string;
  order_status?: string;
  created_at: string;
  items?: unknown[];
  notes?: string | null;
}

interface GroupedReceipts {
  [date: string]: PaymentOrder[];
}

interface RefundOrder extends PaymentOrder {
  refund_amount?: number;
  refund_reason?: string;
  refunded_at?: string;
  refund_id?: string;
}

interface RefundStats {
  totalRefunds: number;
  totalRefundAmount: number;
  refundRate: number;
  commonReasons: { reason: string; count: number }[];
}

export function usePaymentsData(venueId: string) {
  const supabase = createClient();
  const [unpaidOrders, setUnpaidOrders] = useState<PaymentOrder[]>([]);
  const [todayReceipts, setTodayReceipts] = useState<PaymentOrder[]>([]);
  const [historyReceipts, setHistoryReceipts] = useState<PaymentOrder[]>([]);
  const [groupedHistoryReceipts, setGroupedHistoryReceipts] = useState<GroupedReceipts>({});
  const [refundedOrders, setRefundedOrders] = useState<RefundOrder[]>([]);
  const [refundStats, setRefundStats] = useState<RefundStats>({
    totalRefunds: 0,
    totalRefundAmount: 0,
    refundRate: 0,
    commonReasons: [],
  });
  const [loading, setLoading] = useState(true);

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadUnpaidOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("payment_status", "UNPAID")
        .in("payment_method", ["PAY_AT_TILL", "PAY_LATER"])
        .order("created_at", { ascending: false });

      if (!error && data) {
        setUnpaidOrders(data as PaymentOrder[]);
      }
    } catch (error) {
      // Error loading unpaid orders
    }
  };

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadTodayReceipts = async () => {
    try {
      const window = todayWindowForTZ("Europe/London");
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("payment_status", "PAID")
        .gte("created_at", window.startUtcISO || "")
        .lt("created_at", window.endUtcISO || "")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTodayReceipts(data as PaymentOrder[]);
      }
    } catch (error) {
      // Error loading today's receipts
    }
  };

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadHistoryReceipts = async () => {
    try {
      const window = todayWindowForTZ("Europe/London");
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("payment_status", "PAID")
        .lt("created_at", window.startUtcISO || "")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) {
        setHistoryReceipts(data as PaymentOrder[]);
        
        // Group by date
        const grouped: GroupedReceipts = {};
        data.forEach((order) => {
          const date = new Date(order.created_at).toLocaleDateString("en-GB");
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push(order as PaymentOrder);
        });
        setGroupedHistoryReceipts(grouped);
      }
    } catch (error) {
      // Error loading history
    }
  };

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadRefunds = async () => {
    try {
      const { data: refunds, error: refundsError } = await supabase
        .from("refunds")
        .select("*")
        .order("refunded_at", { ascending: false })
        .limit(50);

      if (refundsError) return;

      const orderIds = refunds?.map((r) => r.order_id) || [];
      if (orderIds.length === 0) return;

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .in("id", orderIds);

      if (ordersError) return;

      const refunded = (orders || []).map((order) => {
        const refund = refunds?.find((r) => r.order_id === order.id);
        return {
          ...order,
          refund_amount: refund?.refund_amount,
          refund_reason: refund?.refund_reason,
          refunded_at: refund?.refunded_at,
          refund_id: refund?.id,
        } as RefundOrder;
      });

      setRefundedOrders(refunded);

      // Calculate stats
      const totalRefunds = refunded.length;
      const totalRefundAmount = refunded.reduce((sum, o) => sum + (o.refund_amount || 0), 0);
      const totalRevenue = refunded.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const refundRate = totalRevenue > 0 ? (totalRefundAmount / totalRevenue) * 100 : 0;

      const reasonCounts: Record<string, number> = {};
      refunded.forEach((o) => {
        const reason = o.refund_reason || "Unknown";
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });

      const commonReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setRefundStats({
        totalRefunds,
        totalRefundAmount,
        refundRate,
        commonReasons,
      });
    } catch (error) {
      // Error loading refunds
    }
  };

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadUnpaidOrders(),
      loadTodayReceipts(),
      loadHistoryReceipts(),
      loadRefunds(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  return {
    unpaidOrders,
    todayReceipts,
    historyReceipts,
    groupedHistoryReceipts,
    refundedOrders,
    refundStats,
    loading,
    refresh: loadAllData,
  };
}
