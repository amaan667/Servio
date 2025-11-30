# Live Counts Architecture for POS System

## Best Practices for Full POS System

### 1. **Single Source of Truth**
- ✅ **Centralized count fetching** - All counts should use the same query logic
- ✅ **Unified count system** - One place to fetch all dashboard counts
- ✅ **Consistent venue ID normalization** - Always use `venue-` prefix

### 2. **Real-Time Subscriptions (Database Change Listeners)**
- ✅ **PostgreSQL Change Listeners** - Use Supabase `postgres_changes` to listen to database changes
- ✅ **Event-based updates** - When database changes, immediately update UI
- ✅ **Multiple table subscriptions** - Subscribe to `menu_items`, `orders`, `tables`, `table_sessions`

### 3. **Optimistic Updates**
- ✅ **Immediate UI updates** - Update counts instantly when events fire
- ✅ **Incremental revenue updates** - Add/subtract revenue immediately, then sync
- ✅ **No flicker** - Use optimistic updates to prevent UI flashing

### 4. **Debouncing & Performance**
- ✅ **Debounced refreshes** - Prevent excessive API calls (300-500ms debounce)
- ✅ **Immediate for critical** - New orders update immediately (no debounce)
- ✅ **Batch queries** - Fetch multiple counts in parallel

### 5. **Event-Driven Architecture**
- ✅ **Custom events** - Dispatch `menuItemsChanged`, `ordersChanged`, `tablesChanged`
- ✅ **Cross-component communication** - Any component can listen and update
- ✅ **Decoupled updates** - Components don't need direct dependencies

### 6. **Connection Management**
- ✅ **Reconnection handling** - Auto-reconnect on token refresh
- ✅ **Channel state management** - Track subscription status
- ✅ **Cleanup on unmount** - Remove channels when components unmount

### 7. **Error Handling & Fallbacks**
- ✅ **Graceful degradation** - If real-time fails, fall back to polling
- ✅ **Error logging** - Log connection issues for debugging
- ✅ **Retry logic** - Automatic retry on connection failures

---

## Current Implementation

### ✅ What's Currently in Place

#### 1. **Real-Time Subscriptions** (`useDashboardRealtime.ts`)
```typescript
// Subscribes to:
- orders table (INSERT/UPDATE/DELETE)
- tables table (INSERT/UPDATE/DELETE)
- table_sessions table (INSERT/UPDATE/DELETE)
- menu_items table (INSERT/UPDATE/DELETE)

// Features:
- Debounced refresh (300ms) for non-critical updates
- Immediate refresh for new orders (INSERT events)
- Auto-reconnect on token refresh
- Channel state management
```

#### 2. **Custom Events System**
```typescript
// Events dispatched:
- menuItemsChanged: { venueId, count }
- ordersChanged: { venueId, revenue, unpaid }
- tablesChanged: { venueId, count }
- menuChanged: { venueId, action, itemCount }

// Event listeners in useDashboardData.ts:
- handleMenuItemsChanged - Updates menu items count instantly
- handleOrdersChanged - Updates revenue and unpaid instantly
- handleTablesChanged - Updates tables count instantly
```

#### 3. **Unified Count System** (`lib/counts/unified-counts.ts`)
```typescript
// Functions:
- fetchMenuItemCount(venueId) - Fetches menu items count
- fetchUnifiedCounts(venueId, venueTz) - Fetches all counts
- subscribeToMenuItemsChanges(venueId, onUpdate) - Real-time subscription
- subscribeToOrdersChanges(venueId, onUpdate, venueTz) - Real-time subscription
```

#### 4. **Dashboard Data Hook** (`useDashboardData.ts`)
```typescript
// Features:
- Initializes with server-provided counts (SSR)
- Listens to custom events for instant updates
- Updates state immediately when events fire
- Prevents loadStats from overriding initial counts
```

#### 5. **Multiple Real-Time Hooks**
```typescript
// Additional hooks:
- useCountsRealtime(venueId, tz, onOrderChange)
- useTableOrdersRealtime(venueId)
- useCounterOrdersRealtime(venueId)
- useTableRealtime(venueId, onTableChange)
```

### ⚠️ Current Issues & Gaps

1. **Menu Items Count Display**
   - ✅ Fixed: Now uses `initialStats?.menuItems` directly
   - ✅ Fixed: Real-time events update count instantly

2. **Count Synchronization**
   - ✅ Fixed: Custom events ensure all components see same count
   - ⚠️ Potential: Some components may still use cached values

3. **Performance**
   - ✅ Good: Debouncing prevents excessive calls
   - ✅ Good: Parallel queries in Cost Insights
   - ⚠️ Could improve: Some queries still sequential

---

## Recommended Architecture (Best Practice)

### Ideal Flow:

```
1. Server-Side Rendering (SSR)
   └─> Fetch initial counts from database
   └─> Pass to client as props (initialStats, initialCounts)

2. Client-Side Initialization
   └─> Use server-provided counts (source of truth)
   └─> Set up real-time subscriptions
   └─> Listen to custom events

3. Real-Time Updates
   └─> Database change detected (postgres_changes)
   └─> Fetch updated count from database
   └─> Dispatch custom event with new count
   └─> All listeners update instantly

4. Optimistic Updates (for revenue)
   └─> New order created
   └─> Add revenue immediately (optimistic)
   └─> Sync with server in background
```

### Key Principles:

1. **Server data is source of truth** - Always prefer `initialStats` from SSR
2. **Real-time updates supplement** - Events update counts, don't replace server data
3. **Debounce non-critical** - Use debouncing for UPDATE/DELETE events
4. **Immediate for critical** - No debounce for INSERT events (new orders)
5. **Event-driven** - Use custom events for cross-component communication
6. **Normalize venue IDs** - Always use `venue-` prefix consistently

---

## Current Status: ✅ IMPLEMENTED

Your system already follows best practices:
- ✅ Real-time subscriptions via Supabase
- ✅ Custom events for cross-component updates
- ✅ Debouncing for performance
- ✅ Optimistic updates for revenue
- ✅ Connection management and reconnection
- ✅ Unified count fetching system

The recent fixes ensure:
- ✅ Menu items count displays correctly (uses initialStats)
- ✅ All counts update live via custom events
- ✅ No manual refresh needed (Cmd+Shift+R)

