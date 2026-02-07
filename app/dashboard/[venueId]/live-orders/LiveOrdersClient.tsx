"use client";

/**
 * LiveOrdersClient - Order Management Component
 *
 * Tab Logic:
 * - Live Orders: Recent orders with active statuses
 * - Earlier Today: Orders from today that are not in live orders (orders from earlier today)
 * - History: Orders from previous days
 *
 * Orders automatically move from "Live Orders" to "Earlier Today" after a period of time
 */

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useTabCounts } from "@/hooks/use-tab-counts";
import { OrderCard } from "@/components/orders/OrderCard";
import { mapOrderToCardData } from "@/lib/orders/mapOrderToCardData";
import type { LegacyOrder } from "@/types/orders";
import MobileNav from "@/components/MobileNav";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Hooks
import { useOrderManagement } from "./hooks/useOrderManagement";
import { useBulkOperations } from "./hooks/useBulkOperations";

// Components
import { OrderTabs } from "./components/OrderTabs";
import { StatusHeader } from "./components/StatusHeader";
import { EmptyState } from "./components/EmptyState";
import { BulkCompleteButton } from "./components/BulkCompleteButton";

// Utils
import { isCounterOrder } from "./utils/orderHelpers";
import { LIVE_ORDER_WINDOW_MS, LIVE_WINDOW_STATUSES, LIVE_TABLE_ORDER_STATUSES } from "./constants";

// Types
import { LiveOrdersClientProps, Order } from "./types";

export default function LiveOrdersClient({
  venueId,
  venueName: venueNameProp,
}: LiveOrdersClientProps) {
  const searchParams = useSearchParams();
  const tableFilter = searchParams?.get("table");
  const tabParam = searchParams?.get("tab");
  const orderParam = searchParams?.get("order");
  const searchParam = searchParams?.get("search");

  const parsedTableFilter = tableFilter
    ? tableFilter.startsWith("Table ")
      ? tableFilter.replace("Table ", "")
      : tableFilter
    : null;

  // Initial tab "live" to avoid hydration mismatch (server has no searchParams; client may have tab=all)
  const [activeTab, setActiveTab] = useState("live");
  const [venueName, setVenueName] = useState<string>(venueNameProp || "");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(120000);
  const [searchQuery, setSearchQuery] = useState("");
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Use custom hooks
  const {
    orders,
    allTodayOrders,
    groupedHistoryOrders,
    loading,
    todayWindow,
    setOrders,
    setAllTodayOrders,
    refreshOrders,
    pagination,
  } = useOrderManagement(venueId);

  const { data: tabCounts, refetch: refetchCounts } = useTabCounts(venueId, "", 30);
  const { isBulkCompleting, bulkCompleteAllOrders } = useBulkOperations(venueId);

  // Sync URL params after mount to avoid hydration mismatch (server has no searchParams)
  useEffect(() => {
    const tab = tabParam && ["live", "all", "history"].includes(tabParam) ? tabParam : "live";
    setActiveTab(tab);
    const q = searchParam || orderParam || "";
    if (q) setSearchQuery(q);
  }, [tabParam, searchParam, orderParam]);

  // When table filter is active, search through both live and all tabs
  // Show orders from whichever tab they're in without switching tabs

  // Load venue name
  useEffect(() => {
    if (!venueNameProp) {
      const client = createClient();
      if (!client) return;

      client
        .from("venues")
        .select("venue_name")
        .eq("venue_id", venueId)
        .single()
        .then(({ data }: { data: { venue_name?: string } | null }) =>
          setVenueName(data?.venue_name || "")
        );
    }
  }, [venueId, venueNameProp]);

  // Counts are refreshed by useTabCounts (60s). Only refetch once on mount so tab badges appear.
  useEffect(() => {
    refetchCounts();
  }, [refetchCounts]);

  // Periodically check if orders need to be moved from live to all today
  useEffect(() => {
    if (!todayWindow) return;

    const interval = setInterval(() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - LIVE_ORDER_WINDOW_MS);

      setOrders((prevOrders) => {
        const stillLive = prevOrders.filter((order) => {
          const orderCreatedAt = new Date(order.created_at);
          const isRecent = orderCreatedAt > cutoff;
          const isLiveStatus = LIVE_WINDOW_STATUSES.includes(order.order_status);
          return isRecent && isLiveStatus;
        });

        const movedToAllToday = prevOrders.filter((order) => {
          const orderCreatedAt = new Date(order.created_at);
          return orderCreatedAt <= cutoff || !LIVE_WINDOW_STATUSES.includes(order.order_status);
        });

        if (movedToAllToday.length > 0) {
          setAllTodayOrders((prev) => [...movedToAllToday, ...prev]);
          refetchCounts();
        }

        return stillLive;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [todayWindow, setOrders, setAllTodayOrders, refetchCounts]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("tab", tab);
    if (parsedTableFilter) {
      newUrl.searchParams.set("table", `Table ${parsedTableFilter}`);
    }
    window.history.replaceState(
      {
        /* Empty */
      },
      "",
      newUrl.toString()
    );
  };

  const handleBulkComplete = () => {
    const currentOrders = activeTab === "live" ? orders : allTodayOrders;
    // Include all non-completed orders (last resort: complete everything regardless of paid/served)
    const activeOrders = currentOrders.filter((order) =>
      ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED"].includes(order.order_status)
    );
    bulkCompleteAllOrders(activeOrders, () => {
      refreshOrders();
    });
  };

  const getDisplayCount = (key: "live" | "all" | "history") => {
    const rpc =
      key === "live"
        ? tabCounts?.live_count
        : key === "all"
          ? tabCounts?.earlier_today_count
          : tabCounts?.history_count;
    return typeof rpc === "number" ? rpc : 0;
  };

  // Filter orders by search query (order ID, customer name, customer phone, table number)
  const filterOrdersBySearch = (ordersToFilter: Order[]): Order[] => {
    if (!searchQuery.trim()) return ordersToFilter;

    const query = searchQuery.toLowerCase().trim();

    return ordersToFilter.filter((order) => {
      // Search by order ID
      if (order.id?.toLowerCase().includes(query)) return true;

      // Search by customer name
      if (order.customer_name?.toLowerCase().includes(query)) return true;

      // Search by customer phone
      if (order.customer_phone?.includes(query)) return true;

      // Search by table number
      if (order.table_number?.toString().includes(query)) return true;

      return false;
    });
  };

  // Memoized filtered orders for each tab
  // Derived state - no memoization needed (React Compiler handles this)
  const filteredLiveOrders = (() => {
    let filtered = orders;
    if (parsedTableFilter) {
      filtered = filtered.filter((order) => order.table_number?.toString() === parsedTableFilter);
    }
    return filterOrdersBySearch(filtered);
  })();

  // Derived state - no memoization needed (React Compiler handles this)
  const filteredAllTodayOrders = (() => {
    let filtered = allTodayOrders;
    if (parsedTableFilter) {
      filtered = filtered.filter((order) => order.table_number?.toString() === parsedTableFilter);
    }
    return filterOrdersBySearch(filtered);
  })();

  // Derived state - no memoization needed (React Compiler handles this)
  const filteredHistoryOrders = (() => {
    const allHistoryOrders = Object.values(groupedHistoryOrders).flat();
    let filtered = allHistoryOrders;
    if (parsedTableFilter) {
      filtered = filtered.filter((order) => order.table_number?.toString() === parsedTableFilter);
    }
    return filterOrdersBySearch(filtered);
  })();

  const renderOrderCard = (order: unknown, showActions: boolean = true) => {
    const orderData = order as {
      id?: string;
      table_number?: string | number;
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      order_status?: string;
      total_amount?: number;
      items?: Array<unknown>;
      created_at?: string;
      venue_id?: string;
      payment_status?: string;
      payment_method?: string;
      qr_type?: string;
      fulfillment_type?: string;
      source?: string;
      requires_collection?: boolean;
      [key: string]: unknown;
    };
    const legacyOrder: LegacyOrder = {
      id: orderData.id || "",
      venue_id: orderData.venue_id || "",
      table_number: typeof orderData.table_number === "number" ? orderData.table_number : null,
      customer_name: orderData.customer_name || null,
      customer_phone: orderData.customer_phone || undefined,
      customer_email: orderData.customer_email || undefined,
      order_status: orderData.order_status || "PLACED",
      total_amount: orderData.total_amount || 0,
      items: (orderData.items as LegacyOrder["items"]) || [],
      created_at: orderData.created_at || new Date().toISOString(),
      payment_status: orderData.payment_status,
      payment_method: orderData.payment_method,
      qr_type: orderData.qr_type as LegacyOrder["qr_type"],
      fulfillment_type: orderData.fulfillment_type as LegacyOrder["fulfillment_type"],
      source: orderData.source as LegacyOrder["source"],
      requires_collection: orderData.requires_collection,
    };
    const orderForCard = mapOrderToCardData(legacyOrder, "GBP");

    return (
      <OrderCard
        key={(order as { id: string }).id}
        order={orderForCard}
        variant="auto"
        venueId={venueId}
        showActions={showActions}
        onActionComplete={() => {
          refetchCounts();
          // Refresh orders with updated payment status without full page reload
          refreshOrders();
        }}
      />
    );
  };

  const renderOrdersSection = (ordersToRender: unknown[], title: string, iconColor: string) => {
    const filteredOrders = ordersToRender.filter(
      (order) =>
        !parsedTableFilter ||
        (order as { table_number?: number }).table_number?.toString() === parsedTableFilter
    );

    // If we have a table filter but no orders in this section, return null
    // This allows the order to appear in the correct tab (live or all)
    if (filteredOrders.length === 0) return null;

    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full bg-${iconColor}-500`}></span>
          {title} ({filteredOrders.length})
        </h3>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => renderOrderCard(order, true))}
        </div>
      </div>
    );
  };

  const counts = {
    live: getDisplayCount("live"),
    earlier: getDisplayCount("all"),
    history: getDisplayCount("history"),
  };

  const showLoadingState = loading;

  return (
    <div className="w-full">
      <section className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatusHeader
          autoRefreshEnabled={autoRefreshEnabled}
          refreshInterval={refreshInterval}
          onToggleAutoRefresh={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          onChangeRefreshInterval={(interval) => setRefreshInterval(interval * 1000)}
          tableFilter={parsedTableFilter}
          venueId={venueId}
        />

        {/* Search Bar */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by order ID, customer name, phone, or table number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 w-full"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <OrderTabs activeTab={activeTab} onTabChange={handleTabChange} counts={counts} />

        {activeTab === "live" && (
          <div className="flex justify-center">
            <div className="hidden md:flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-white ring-1 ring-rose-100">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Live Orders – recent orders (including completed orders)</span>
            </div>
          </div>
        )}
      </section>

      <main className="mt-4 space-y-6 pb-20">
        {activeTab === "live" && (
          <div className="space-y-6">
            {showLoadingState ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-gray-700">
                <p className="text-lg font-medium">Loading orders…</p>
              </div>
            ) : (
              (() => {
                // Combine live and all today orders if table filter is active
                const allFilteredOrders = parsedTableFilter
                  ? [...filteredLiveOrders, ...filteredAllTodayOrders]
                  : filteredLiveOrders;

                if (allFilteredOrders.length === 0) {
                  return (
                    <EmptyState
                      title={searchQuery ? "No orders found" : "No Live Orders"}
                      description={
                        searchQuery
                          ? "Try adjusting your search query"
                          : "Recent orders will appear here"
                      }
                    />
                  );
                }

                return (
                  <>
                    <BulkCompleteButton
                      count={
                        allFilteredOrders.filter((order) =>
                          ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED"].includes(
                            order.order_status
                          )
                        ).length
                      }
                      isCompleting={isBulkCompleting}
                      onClick={handleBulkComplete}
                    />

                    {searchQuery && (
                      <div className="text-sm text-gray-600 mb-4">
                        Found {allFilteredOrders.length} order
                        {allFilteredOrders.length !== 1 ? "s" : ""} matching "{searchQuery}"
                      </div>
                    )}

                    {renderOrdersSection(
                      allFilteredOrders.filter((order) => isCounterOrder(order)),
                      "Counter Orders",
                      "orange"
                    )}

                    {renderOrdersSection(
                      allFilteredOrders.filter(
                        (order) =>
                          !isCounterOrder(order) &&
                          LIVE_TABLE_ORDER_STATUSES.includes(order.order_status)
                      ),
                      "Table Orders",
                      "blue"
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}

        {activeTab === "all" && (
          <div className="space-y-6">
            {showLoadingState ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-gray-700">
                <p className="text-lg font-medium">Loading orders…</p>
              </div>
            ) : (
              (() => {
                // Combine live and all today orders if table filter is active
                const allFilteredOrders = parsedTableFilter
                  ? [...filteredLiveOrders, ...filteredAllTodayOrders]
                  : filteredAllTodayOrders;

                if (allFilteredOrders.length === 0) {
                  return (
                    <EmptyState
                      title={searchQuery ? "No orders found" : "No Earlier Orders Today"}
                      description={
                        searchQuery
                          ? "Try adjusting your search query"
                          : "Orders from earlier today will appear here"
                      }
                    />
                  );
                }

                return (
                  <>
                    <BulkCompleteButton
                      count={
                        allFilteredOrders.filter((order) =>
                          ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED"].includes(
                            order.order_status
                          )
                        ).length
                      }
                      isCompleting={isBulkCompleting}
                      onClick={handleBulkComplete}
                    />

                    {searchQuery && (
                      <div className="text-sm text-gray-600 mb-4">
                        Found {allFilteredOrders.length} order
                        {allFilteredOrders.length !== 1 ? "s" : ""} matching "{searchQuery}"
                      </div>
                    )}

                    {renderOrdersSection(
                      allFilteredOrders.filter((order) => isCounterOrder(order)),
                      "Counter Orders",
                      "orange"
                    )}

                    {renderOrdersSection(
                      allFilteredOrders.filter((order) => !isCounterOrder(order)),
                      "Table Orders",
                      "blue"
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            {showLoadingState ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-gray-700">
                <p className="text-lg font-medium">Loading orders…</p>
              </div>
            ) : filteredHistoryOrders.length === 0 ? (
              <EmptyState
                title={searchQuery ? "No orders found" : "No Historical Orders"}
                description={
                  searchQuery
                    ? "Try adjusting your search query"
                    : "Previous orders will appear here"
                }
              />
            ) : (
              (() => {
                // Group filtered history orders by date
                const groupedFiltered = filteredHistoryOrders.reduce<Record<string, Order[]>>(
                  (acc, order) => {
                    if (!order) return acc;
                    const date = new Date(order.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                    (acc[date] ??= []).push(order);
                    return acc;
                  },
                  {}
                );

                return (
                  <>
                    {searchQuery && (
                      <div className="text-sm text-gray-600 mb-4">
                        Found {filteredHistoryOrders.length} order
                        {filteredHistoryOrders.length !== 1 ? "s" : ""} matching "{searchQuery}"
                      </div>
                    )}
                    {Object.entries(groupedFiltered).map(([date, ordersForDate]) => (
                      <div key={date} className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-gray-900">{date}</h3>
                          <span className="bg-slate-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                            {ordersForDate.length} order{ordersForDate.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {renderOrdersSection(
                          ordersForDate.filter((order) => isCounterOrder(order)),
                          "Counter Orders",
                          "orange"
                        )}

                        {renderOrdersSection(
                          ordersForDate.filter((order) => !isCounterOrder(order)),
                          "Table Orders",
                          "blue"
                        )}
                      </div>
                    ))}
                    
                    {/* Load More Button for History */}
                    {pagination.historyHasMore && (
                      <div className="flex justify-center mt-6">
                        <Button
                          variant="outline"
                          onClick={pagination.loadMoreHistory}
                          disabled={pagination.historyLoading}
                        >
                          {pagination.historyLoading ? "Loading..." : "Load More"}
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}
      </main>

      <MobileNav
        venueId={venueId}
        venueName={venueName}
        counts={{
          live_orders: counts.live,
          total_orders: counts.earlier,
          notifications: 0,
        }}
      />
    </div>
  );
}
