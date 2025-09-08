# Partitioned Orders System

This system ensures orders appear in only one tab with proper timezone handling and mutually exclusive time windows.

## Overview

The partitioned orders system divides orders into three distinct tabs based on time boundaries:

1. **Live (Last 30 min)**: Orders created within the last 30 minutes, regardless of day
2. **Today (All Orders)**: Orders placed today in the venue's timezone, excluding live orders
3. **History**: Orders from previous days

## Key Principles

- **No Duplicates**: Each order appears in exactly one tab
- **Time Precedence**: LIVE takes priority over TODAY; anything not today falls into HISTORY
- **Timezone Aware**: Day boundaries use the venue's timezone
- **Consistent Counts**: Badge counts and list contents use identical filters

## Implementation

### 1. Time Windows Helper (`lib/time-windows.ts`)

```typescript
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'
import { startOfDay, subMinutes } from 'date-fns'

export function timeWindows(venueTz: string) {
  const nowUtc = new Date()                    // timestamps are UTC in DB
  const nowLocal = utcToZonedTime(nowUtc, venueTz)

  const startOfTodayLocal = startOfDay(nowLocal)
  const startOfTodayUtc = zonedTimeToUtc(startOfTodayLocal, venueTz)

  const thirtyMinAgoUtc = subMinutes(nowUtc, 30)

  return { nowUtc, startOfTodayUtc, thirtyMinAgoUtc }
}
```

### 2. Partitioned Hooks (`hooks/usePartitionedOrders.ts`)

Three separate hooks that fetch mutually exclusive order sets:

- `useLiveOrders(venueId, venueTz)` - Orders within last 30 minutes
- `useTodayOrders(venueId, venueTz)` - Today's orders excluding live window
- `useHistoryOrders(venueId, venueTz)` - Orders from before today

### 3. Database Function (`scripts/update-dashboard-counts-partitioned.sql`)

Updated `dashboard_counts` function that returns counts matching the new logic:

```sql
-- Live: Orders within last 30 minutes (regardless of status or day)
live as (
  select count(*)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
),
-- Today: Orders from today that are NOT in live window
today as (
  select count(*)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at >= b.start_utc
    and o.created_at < b.now_utc - make_interval(mins => p_live_window_mins)
),
-- History: Orders from before today
history as (
  select count(*)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at < b.start_utc
)
```

### 4. React Component (`components/live-orders-partitioned.tsx`)

New component that uses the partitioned hooks and ensures:

- Orders never appear in multiple tabs
- Tab switching doesn't change counts
- Auto-refresh on 15-second intervals
- Consistent badge counts

## Edge Cases Handled

### Midnight Crossing

- Live orders from the previous date remain in Live for 30 minutes
- Once they age >30m, they fall to History (not Today)
- This prevents orders from jumping between tabs at midnight

### Timezone Correctness

- Day boundaries calculated in venue's timezone
- All comparisons done in UTC for consistency
- No double-rendering due to overlapping time windows

## Usage

### Basic Implementation

```typescript
import { LiveOrdersPartitioned } from '@/components/live-orders-partitioned'

function Dashboard({ venueId, venueTimezone }) {
  return (
    <LiveOrdersPartitioned 
      venueId={venueId} 
      venueTimezone={venueTimezone || 'Europe/London'} 
    />
  )
}
```

### Using Individual Hooks

```typescript
import { useLiveOrders, useTodayOrders, useHistoryOrders } from '@/hooks/usePartitionedOrders'

function OrderManager({ venueId, venueTimezone }) {
  const { data: liveData, count: liveCount } = useLiveOrders(venueId, venueTimezone)
  const { data: todayData, count: todayCount } = useTodayOrders(venueId, venueTimezone)
  const { data: historyData, count: historyCount } = useHistoryOrders(venueId, venueTimezone)

  return (
    <div>
      <div>Live: {liveCount}</div>
      <div>Today: {todayCount}</div>
      <div>History: {historyCount}</div>
    </div>
  )
}
```

## Deployment

### 1. Install Dependencies

```bash
pnpm add date-fns@^3.0.0 date-fns-tz
```

### 2. Update Database Function

```bash
# Apply the new SQL function
psql $DATABASE_URL -f scripts/update-dashboard-counts-partitioned.sql
```

### 3. Deploy Application

```bash
railway up
```

### 4. Or Use the Deployment Script

```bash
./deploy-partitioned-orders.sh
```

## Testing

### Verify No Duplicates

1. Create an order
2. Check it appears in Live tab
3. Wait 31 minutes
4. Verify it moved to Today tab
5. Wait until next day
6. Verify it moved to History tab

### Verify Counts Consistency

1. Note the badge count on Live tab
2. Switch to Live tab
3. Verify the order count matches the badge count
4. Repeat for Today and History tabs

### Verify Timezone Handling

1. Set venue timezone to different timezone
2. Create orders at different times
3. Verify day boundaries respect venue timezone
4. Verify orders appear in correct tabs

## Migration from Existing System

The new system is designed to be a drop-in replacement:

1. **Replace existing components** with `LiveOrdersPartitioned`
2. **Update database function** using the provided SQL script
3. **Install new dependencies** (date-fns-tz)
4. **Test thoroughly** to ensure no regressions

## Benefits

- **No Duplicate Orders**: Each order appears exactly once
- **Consistent Counts**: Badge counts always match list contents
- **Timezone Correct**: Proper handling of venue timezones
- **Performance**: Efficient queries with no client-side filtering
- **Maintainable**: Clear separation of concerns and logic
- **Scalable**: Handles edge cases like midnight crossing gracefully

## Troubleshooting

### Orders Appearing in Multiple Tabs

- Check that the database function was updated correctly
- Verify timezone settings on the venue
- Check browser console for any errors

### Counts Not Matching

- Ensure all three hooks are using the same venueId and venueTimezone
- Check that the database function returns the expected structure
- Verify no client-side filtering is happening

### Timezone Issues

- Confirm venue timezone is set correctly in the database
- Check that `date-fns-tz` is properly installed
- Verify the timeWindows function is working correctly
