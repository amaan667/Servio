import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";
import { PersistentCache } from "@/lib/persistent-cache";
import { Order } from "../types";

const LIVE_ORDER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const LIVE_WINDOW_STATUSES = ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED", "COMPLETED"];

export function useOrderManagement(venueId: string) {
  // ANTI-FLICKER: Get cached data immediately
  const cachedLiveOrders = PersistentCache.get<Order[]>(`live_orders_${venueId}`) || [];
  const cachedAllToday = PersistentCache.get<Order[]>(`all_today_orders_${venueId}`) || [];
  const cachedHistory = PersistentCache.get<Order[]>(`history_orders_${venueId}`) || [];
  const cachedGroupedHistory =
    PersistentCache.get<Record<string, Order[]>>(`grouped_history_${venueId}`) ||
    {
      /* Empty */
    };

  const [orders, setOrders] = useState<Order[]>(cachedLiveOrders);
  const [allTodayOrders, setAllTodayOrders] = useState<Order[]>(cachedAllToday);
  const [historyOrders, setHistoryOrders] = useState<Order[]>(cachedHistory);
  const [groupedHistoryOrders, setGroupedHistoryOrders] =
    useState<Record<string, Order[]>>(cachedGroupedHistory);
  const [loading, setLoading] = useState(cachedLiveOrders.length === 0); // Only show loading if no cache
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(
    null
  );

  useEffect(() => {
    const loadOrders = async () => {
      const window = todayWindowForTZ("Europe/London");
      if (window.startUtcISO && window.endUtcISO) {
        setTodayWindow({
          startUtcISO: window.startUtcISO,
          endUtcISO: window.endUtcISO,
        });
      }

      const liveOrdersCutoff = new Date(Date.now() - LIVE_ORDER_WINDOW_MS).toISOString();

      const { data: liveData, error: liveError } = await createClient()
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .in("order_status", LIVE_WINDOW_STATUSES)
        .gte("created_at", window.startUtcISO)
        .lt("created_at", window.endUtcISO)
        .gte("created_at", liveOrdersCutoff)
        .or("payment_status.eq.PAID,payment_method.eq.PAY_LATER,payment_method.eq.PAY_AT_TILL") // Only show PAID orders or confirmed UNPAID (Pay Later/Till)
        .order("created_at", { ascending: false });

      const { data: allData, error: allError } = await createClient()
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", window.startUtcISO)
        .lt("created_at", liveOrdersCutoff)
        .or("payment_status.eq.PAID,payment_method.eq.PAY_LATER,payment_method.eq.PAY_AT_TILL") // Only show confirmed orders
        .order("created_at", { ascending: false });

      const { data: historyData, error: historyError } = await createClient()
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .lt("created_at", window.startUtcISO)
        .or("payment_status.eq.PAID,payment_method.eq.PAY_LATER,payment_method.eq.PAY_AT_TILL") // Only show confirmed orders
        .order("created_at", { ascending: false })
        .limit(100);

      if (!liveError && liveData) {
        const liveOrders = liveData as Order[];
        setOrders(liveOrders);
        // ANTI-FLICKER: Cache live orders
        PersistentCache.set(`live_orders_${venueId}`, liveOrders, 2 * 60 * 1000); // 2 min TTL
      }

      if (!allError && allData) {
        const liveOrderIds = new Set(
          (liveData || []).map((order: Record<string, unknown>) => order.id)
        );
        const allTodayFiltered = allData.filter(
          (order: Record<string, unknown>) => !liveOrderIds.has(order.id)
        ) as Order[];
        setAllTodayOrders(allTodayFiltered);
        // ANTI-FLICKER: Cache all today orders
        PersistentCache.set(`all_today_orders_${venueId}`, allTodayFiltered, 5 * 60 * 1000); // 5 min TTL
      }

      if (!historyError && historyData) {
        const processedHistory = (historyData as Order[]).map((order: Order) => ({
          ...order,
          payment_status: "PAID",
          order_status: "COMPLETED" as const,
        }));

        setHistoryOrders(processedHistory);
        // ANTI-FLICKER: Cache history orders
        PersistentCache.set(`history_orders_${venueId}`, processedHistory, 10 * 60 * 1000); // 10 min TTL

        const grouped = processedHistory.reduce(
          (acc: Record<string, Order[]>, order) => {
            const date = new Date(order.created_at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            if (!acc[date]) acc[date] = [];
            acc[date].push(order);
            return acc;
          },
          {
            /* Empty */
          }
        );
        setGroupedHistoryOrders(grouped);
        // ANTI-FLICKER: Cache grouped history
        PersistentCache.set(`grouped_history_${venueId}`, grouped, 10 * 60 * 1000); // 10 min TTL
      }

      setLoading(false);
    };

    loadOrders();

    // Set up real-time subscription
    const channel = createClient()
      .channel("orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: {
          eventType: string;
          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        }) => {
          const newOrder = payload.new ? (payload.new as unknown as Order) : undefined;
          const oldOrder = payload.old ? (payload.old as unknown as Order) : undefined;

          if (payload.eventType === "INSERT" && newOrder) {
            handleOrderInsert(newOrder);
          } else if (payload.eventType === "UPDATE" && newOrder) {
            handleOrderUpdate(newOrder);
          } else if (payload.eventType === "DELETE" && oldOrder) {
            handleOrderDelete(oldOrder);
          }
        }
      )
      .subscribe();

    return () => {
      createClient().removeChannel(channel);
    };
  }, [venueId]);

  const handleOrderInsert = (order: Order) => {
    const isLiveOrder = LIVE_WINDOW_STATUSES.includes(order.order_status);
    const orderCreatedAt = new Date(order.created_at);
    const isRecentOrder = orderCreatedAt > new Date(Date.now() - LIVE_ORDER_WINDOW_MS);

    if (isLiveOrder && isRecentOrder) {
      setOrders((prev) => [order, ...prev]);
    }

    const isInTodayWindow =
      orderCreatedAt &&
      todayWindow &&
      orderCreatedAt >= new Date(todayWindow.startUtcISO) &&
      orderCreatedAt < new Date(todayWindow.endUtcISO);

    if (isInTodayWindow && !(isLiveOrder && isRecentOrder)) {
      setAllTodayOrders((prev) => [order, ...prev]);
    } else if (!isInTodayWindow) {
      const processedOrder = {
        ...order,
        payment_status: "PAID",
        order_status: "COMPLETED" as const,
      };
      setHistoryOrders((prev) => [processedOrder, ...prev]);

      const date = new Date(order.created_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      setGroupedHistoryOrders((prev) => ({
        ...prev,
        [date]: [processedOrder, ...(prev[date] || [])],
      }));
    }
  };

  const handleOrderUpdate = (order: Order) => {
    const isLiveOrder = LIVE_WINDOW_STATUSES.includes(order.order_status);
    const orderCreatedAt = new Date(order.created_at);
    const isRecentOrder = orderCreatedAt > new Date(Date.now() - LIVE_ORDER_WINDOW_MS);

    if (isLiveOrder && isRecentOrder) {
      setOrders((prev) => {
        const exists = prev.find((o) => o.id === order.id);
        if (!exists) return [order, ...prev];
        return prev.map((o) => (o.id === order.id ? order : o));
      });
      setAllTodayOrders((prev) => prev.filter((o) => o.id !== order.id));
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== order.id));

      if (
        todayWindow &&
        orderCreatedAt >= new Date(todayWindow.startUtcISO) &&
        orderCreatedAt < new Date(todayWindow.endUtcISO)
      ) {
        setAllTodayOrders((prev) => {
          const exists = prev.find((o) => o.id === order.id);
          if (!exists) return [order, ...prev];
          return prev.map((o) => (o.id === order.id ? order : o));
        });
      }
    }

    setHistoryOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
  };

  const handleOrderDelete = (order: Order) => {
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setAllTodayOrders((prev) => prev.filter((o) => o.id !== order.id));
    setHistoryOrders((prev) => prev.filter((o) => o.id !== order.id));
  };

  return {
    orders,
    allTodayOrders,
    historyOrders,
    groupedHistoryOrders,
    loading,
    todayWindow,
    setOrders,
    setAllTodayOrders,
  };
}
