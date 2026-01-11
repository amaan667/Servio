"use client";

import React, { useMemo } from "react";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const LiveOrdersList = React.memo(function LiveOrdersList({ venueId }: { venueId: string }) {
  const { data, isLoading, isError, error } = useLiveOrders(venueId);

  // Debounce data updates to prevent excessive re-renders
  const debouncedData = useDebouncedValue(data, 300);

  // Memoize the rendered orders to prevent unnecessary re-renders
  const renderedOrders = useMemo(() => {
    if (!debouncedData || debouncedData.length === 0) return null;

    return debouncedData.map((o) => (
      <article key={o.id} className="rounded-xl border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">£{o.total_amount.toFixed(2)}</span>
          <span className="rounded-full border px-2 py-0.5 text-xs">{o.order_status}</span>
        </div>
        <div className="mt-1 text-sm text-gray-700">
          {o.table_number ? `Table ${o.table_number}` : "—"}
        </div>
        <div className="mt-1 text-sm text-gray-700">{o.customer_name}</div>
        <div className="mt-1 text-xs text-gray-700">
          {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </article>
    ));
  }, [debouncedData]);

  // Remove loading state - render immediately with empty state if needed

  if (isError) {
    return (
      <div className="text-rose-600">
        <div>
          Failed to load orders.{" "}
          {error && typeof error === "object" && "message" in error
            ? (error as { message: string }).message
            : "Unknown error"}
        </div>
      </div>
    );
  }

  if (!debouncedData || debouncedData.length === 0) {
    return (
      <div className="text-gray-700">
        <div>No active orders at the moment.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{renderedOrders}</div>
    </div>
  );
});

export default LiveOrdersList;
