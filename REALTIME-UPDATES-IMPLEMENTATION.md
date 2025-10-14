# Real-Time Updates Implementation Guide

## Overview

This document outlines the comprehensive real-time update system implemented across the Servio platform. All counts, statistics, and order information now update automatically without requiring manual page refreshes.

## What's Been Implemented

### 1. Dashboard Real-Time Updates (`app/dashboard/[venueId]/page.client.tsx`)

**Updated Data:**
- Today's order count
- Revenue (with incremental updates)
- Table counts (set up, in use, reserved)
- Menu items count
- Table session updates

**Features:**
- ✅ Real-time subscriptions for orders, tables, table_sessions, and menu_items
- ✅ Incremental revenue updates (prevents flickering)
- ✅ Automatic count refresh on any order change
- ✅ Fallback polling every 30 seconds if real-time fails
- ✅ Comprehensive logging for debugging
- ✅ Connection status monitoring

**Subscriptions:**
```javascript
// Orders table - updates counts and revenue
.on('postgres_changes', { table: 'orders', filter: `venue_id=eq.${venueId}` })

// Tables table - updates table counts
.on('postgres_changes', { table: 'tables', filter: `venue_id=eq.${venueId}` })

// Table sessions - updates occupancy
.on('postgres_changes', { table: 'table_sessions', filter: `venue_id=eq.${venueId}` })

// Menu items - updates item count
.on('postgres_changes', { table: 'menu_items', filter: `venue_id=eq.${venueId}` })
```

### 2. Bottom Navigation Real-Time Updates

**Files Updated:**
- `components/ConditionalBottomNav.tsx`
- `components/GlobalBottomNav.tsx`

**Features:**
- ✅ Live order count updates in navigation
- ✅ Real-time subscription for order changes
- ✅ Automatic refresh on order events

### 3. Live Orders Page

**File:** `app/dashboard/[venueId]/live-orders/LiveOrdersClient.tsx`

**Features:**
- ✅ Already had real-time subscriptions
- ✅ Auto-updates live, earlier today, and history tabs
- ✅ Order status changes reflect immediately
- ✅ Tab count updates in real-time

### 4. Table Management Real-Time Updates

**New Hooks Created:**
- `useCounterOrdersRealtime()` - Real-time counter order updates
- `useTableOrdersRealtime()` - Real-time table order updates

**Files Updated:**
- `hooks/useCounterOrders.ts`
- `hooks/useTableOrders.ts`
- `app/dashboard/[venueId]/tables/table-management-client-new.tsx`

**Features:**
- ✅ Counter order counts update automatically
- ✅ Table order counts update automatically
- ✅ Uses React Query invalidation for efficient updates
- ✅ Separate subscriptions for counter vs table orders

### 5. Analytics Dashboard

**File:** `components/analytics-dashboard.tsx`

**Features:**
- ✅ Already had real-time subscriptions
- ✅ Updates charts and statistics automatically
- ✅ Recalculates metrics on order changes

### 6. Kitchen Display System (KDS)

**File:** `app/dashboard/[venueId]/kds/KDSClient.tsx`

**Features:**
- ✅ Already had real-time subscriptions
- ✅ Ticket updates appear instantly
- ✅ Auto-refresh every 30 seconds as backup

## How Real-Time Works

### Supabase Configuration

Enhanced the Supabase client configuration to optimize real-time performance:

**File:** `lib/supabase/client.ts`

```javascript
createBrowserClient(url, anon, {
  auth: { /* ... */ },
  realtime: {
    params: {
      eventsPerSecond: 10,  // Rate limiting
    },
  },
  global: {
    headers: {
      'x-client-info': 'servio-dashboard',
    },
  },
})
```

### Subscription Pattern

All real-time subscriptions follow this pattern:

```javascript
const channel = supabase
  .channel('unique-channel-name')
  .on('postgres_changes', {
    event: '*',              // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'table_name',
    filter: `venue_id=eq.${venueId}`
  }, (payload) => {
    // Handle update
    console.log('[COMPONENT] Update received:', payload.eventType);
    refreshData();
  })
  .subscribe((status) => {
    console.log('[COMPONENT] Subscription status:', status);
  });

// Cleanup
return () => {
  supabase.removeChannel(channel);
};
```

### React Query Integration

For components using React Query, we use query invalidation:

```javascript
export function useTableOrdersRealtime(venueId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`table-orders-${venueId}`)
      .on('postgres_changes', { /* ... */ }, () => {
        // Invalidate queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['table-orders', venueId] });
        queryClient.invalidateQueries({ queryKey: ['table-order-counts', venueId] });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [venueId, queryClient]);
}
```

## Components Updated

### Dashboard Components
1. ✅ **Main Dashboard** - All counts and stats
2. ✅ **Bottom Navigation** - Live order count
3. ✅ **Live Orders** - Order lists and counts
4. ✅ **Table Management** - Table orders and counter orders
5. ✅ **Analytics** - Charts and statistics
6. ✅ **KDS** - Kitchen tickets

### Hook Components
1. ✅ **useCounterOrders** - Added real-time hook
2. ✅ **useTableOrders** - Added real-time hook
3. ✅ **useCountsRealtime** - Already existed
4. ✅ **useTableRealtime** - Already existed

## Testing Real-Time Updates

### Dashboard Testing
1. Open dashboard in one browser tab
2. Place an order from customer view in another tab
3. Watch the dashboard update automatically:
   - Today's order count increases
   - Revenue updates incrementally
   - Table counts update if applicable

### Live Orders Testing
1. Open Live Orders page
2. Place a new order
3. Order appears in Live tab immediately
4. Update order status - changes reflect instantly

### Table Management Testing
1. Open Table Management page
2. Place a counter or table order
3. Order counts update automatically
4. Status changes reflect immediately

## Debugging Real-Time

All real-time subscriptions include comprehensive logging:

```javascript
// Dashboard logs
[DASHBOARD] Setting up real-time subscriptions for venue: {venueId}
[DASHBOARD] Order update received: INSERT {orderId}
[DASHBOARD] Refreshing counts due to order change
[DASHBOARD] Realtime subscription status: SUBSCRIBED

// Counter orders logs
[COUNTER ORDERS] Setting up real-time subscription for venue: {venueId}
[COUNTER ORDERS] Counter order update received: UPDATE
[COUNTER ORDERS] Realtime subscription status: SUBSCRIBED

// Table orders logs
[TABLE ORDERS] Setting up real-time subscription for venue: {venueId}
[TABLE ORDERS] Table order update received: INSERT
[TABLE ORDERS] Realtime subscription status: SUBSCRIBED
```

### Checking Subscription Status

Open browser console and look for:
- ✓ `SUBSCRIBED` - Connection successful
- ✗ `CHANNEL_ERROR` - Connection failed
- ✗ `TIMED_OUT` - Connection timeout

## Fallback Mechanisms

### 1. Polling Fallback
The dashboard includes a 30-second polling fallback:
```javascript
// Polls every 30 seconds if real-time fails
setInterval(() => {
  console.log('[DASHBOARD] Polling for updates (fallback)');
  await refreshCounts();
}, 30000);
```

### 2. React Query Polling
Table and counter orders use React Query's built-in polling:
```javascript
refetchInterval: 15000,  // 15 seconds
```

### 3. Focus-Based Refresh
Table management refetches on window focus:
```javascript
window.addEventListener('focus', () => {
  refetchTables();
});
```

## Performance Considerations

### Rate Limiting
- Supabase real-time limited to 10 events/second
- Debouncing applied to rapid updates
- Query invalidation batched where possible

### Memory Management
- All subscriptions properly cleaned up on unmount
- Channel names unique per venue to prevent conflicts
- Stale queries garbage collected after 30 seconds

### Network Efficiency
- Only subscribe to relevant venue data
- Use filter clauses to minimize payload
- Incremental updates where possible (e.g., revenue)

## Supabase Real-Time Requirements

### Database Configuration
Ensure Supabase has real-time enabled for these tables:
- ✅ `orders`
- ✅ `tables`
- ✅ `table_sessions`
- ✅ `menu_items`
- ✅ `reservations`
- ✅ `kds_tickets`

### Row Level Security (RLS)
Real-time respects RLS policies. Ensure policies allow:
- Read access to orders for venue owners
- Read access to tables for venue owners
- Read access to table_sessions for venue owners

## Troubleshooting

### Real-Time Not Working

1. **Check Supabase Dashboard**
   - Verify real-time is enabled for your project
   - Check table publications include required tables

2. **Check Browser Console**
   - Look for subscription status logs
   - Check for CHANNEL_ERROR or TIMED_OUT messages

3. **Verify Environment Variables**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=<your-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
   ```

4. **Check Network**
   - Real-time uses WebSockets
   - Ensure WebSocket connections allowed through firewall
   - Check browser DevTools > Network > WS tab

### Polling Still Active

Even with real-time working, polling provides:
- Backup if real-time connection drops
- Data consistency check
- Recovery from missed events

This is intentional and ensures reliability.

## Future Enhancements

### Potential Improvements
- [ ] Add optimistic updates for better UX
- [ ] Implement presence channels for multi-user awareness
- [ ] Add real-time notifications for critical events
- [ ] Compress real-time payloads for better performance
- [ ] Add connection quality indicators

### Monitoring
- [ ] Track real-time connection uptime
- [ ] Monitor subscription error rates
- [ ] Measure update latency

## Summary

All major dashboard components now update in real-time:
- ✅ Main dashboard counts and statistics
- ✅ Bottom navigation live order count
- ✅ Live orders page
- ✅ Table management orders
- ✅ Analytics charts
- ✅ Kitchen display system

**No manual refresh needed!** 🎉

The system automatically detects and displays:
- New orders placed by customers
- Order status changes
- Table occupancy changes
- Menu item updates
- Revenue updates

Users can now monitor their venue in real-time without any manual intervention.


