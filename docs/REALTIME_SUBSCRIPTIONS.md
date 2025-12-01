# Real-time Subscriptions Guide

Servio uses Supabase Realtime for live updates across the application.

## Overview

Real-time subscriptions allow the application to receive instant updates when data changes in the database, without polling.

## Basic Usage

### Orders Subscription

```typescript
import { createClient } from "@/lib/supabase";
import { useEffect } from "react";

function useOrdersSubscription(venueId: string) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`venue:${venueId}:orders`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload) => {
          console.log("Order update:", payload);
          // Handle update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);
}
```

### Table Sessions Subscription

```typescript
function useTableSessionsSubscription(venueId: string) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`venue:${venueId}:table-sessions`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_sessions",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // New table session
          } else if (payload.eventType === "UPDATE") {
            // Updated session
          } else if (payload.eventType === "DELETE") {
            // Closed session
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);
}
```

## Advanced Patterns

### Multiple Tables

```typescript
function useVenueUpdates(venueId: string) {
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`venue:${venueId}:updates`)
      // Orders
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        handleOrderUpdate
      )
      // Table sessions
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_sessions",
          filter: `venue_id=eq.${venueId}`,
        },
        handleTableSessionUpdate
      )
      // KDS tickets
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kds_tickets",
          filter: `venue_id=eq.${venueId}`,
        },
        handleKDSTicketUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);
}
```

### Optimistic Updates

```typescript
function useOptimisticOrderUpdate() {
  const [orders, setOrders] = useState<Order[]>([]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    // Optimistic update
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, order_status: status } : order
      )
    );

    try {
      // Actual update
      await supabase
        .from("orders")
        .update({ order_status: status })
        .eq("id", orderId);
    } catch (error) {
      // Revert on error
      // Re-fetch or revert state
    }
  };

  // Subscribe to real updates
  useEffect(() => {
    const channel = supabase
      .channel("order-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          // Sync with server state
          setOrders((prev) =>
            prev.map((order) =>
              order.id === payload.new.id ? payload.new : order
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { orders, updateOrderStatus };
}
```

### Debounced Updates

```typescript
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

function useDebouncedSubscription(venueId: string) {
  const [updates, setUpdates] = useState<any[]>([]);
  const debouncedUpdates = useDebouncedValue(updates, 500);

  useEffect(() => {
    const channel = supabase
      .channel(`venue:${venueId}:updates`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload) => {
          // Collect updates
          setUpdates((prev) => [...prev, payload]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  // Process debounced updates
  useEffect(() => {
    if (debouncedUpdates.length > 0) {
      // Batch process updates
      processUpdates(debouncedUpdates);
      setUpdates([]);
    }
  }, [debouncedUpdates]);
}
```

## Best Practices

### 1. Clean Up Subscriptions

Always unsubscribe when component unmounts:

```typescript
useEffect(() => {
  const channel = supabase.channel("...").subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### 2. Use Specific Filters

```typescript
// ❌ Bad: Too broad
.filter(`venue_id=eq.${venueId}`)

// ✅ Good: More specific
.filter(`venue_id=eq.${venueId}&order_status=eq.active`)
```

### 3. Handle Connection States

```typescript
const channel = supabase
  .channel("orders")
  .on("postgres_changes", { ... }, handleUpdate)
  .on("system", { event: "*" }, (payload) => {
    if (payload.status === "SUBSCRIBED") {
      console.log("Connected to real-time");
    } else if (payload.status === "CHANNEL_ERROR") {
      console.error("Real-time error:", payload);
    }
  })
  .subscribe();
```

### 4. Error Handling

```typescript
useEffect(() => {
  const channel = supabase
    .channel("orders")
    .on("postgres_changes", { ... }, (payload) => {
      try {
        handleUpdate(payload);
      } catch (error) {
        logger.error("Error handling real-time update", { error, payload });
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## Performance Considerations

### Limit Subscriptions

Don't create too many subscriptions:

```typescript
// ❌ Bad: One subscription per order
orders.forEach(order => {
  supabase.channel(`order:${order.id}`).subscribe();
});

// ✅ Good: One subscription for all orders
supabase.channel("orders").on("postgres_changes", {
  filter: `venue_id=eq.${venueId}`,
}, handleUpdate).subscribe();
```

### Use Selective Updates

Only update what changed:

```typescript
.on("postgres_changes", { ... }, (payload) => {
  if (payload.eventType === "UPDATE") {
    // Only update the changed order
    updateOrderInState(payload.new.id, payload.new);
  }
});
```

## Troubleshooting

### Subscription Not Working

1. Check Supabase Realtime is enabled for the table
2. Verify RLS policies allow access
3. Check browser console for errors
4. Verify channel name is unique

### Too Many Updates

1. Add more specific filters
2. Debounce updates
3. Batch process updates
4. Use pagination for initial load

## Resources

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [PostgreSQL Change Data Capture](https://supabase.com/docs/guides/realtime/postgres-changes)


