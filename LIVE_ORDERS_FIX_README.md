# Live Orders Loading Fix

## Problem
The live orders component was stuck on "Loading orders..." indefinitely, even though the badge counts were working correctly. This typically indicates:
- Count query finishes but list query never resolves
- Silent RLS/SQL errors
- Mismatched filters between badge and list
- Pagination issues
- Query never returns due to early returns

## Solution
Implemented a drop-in fix with a reliable `useLiveOrders` hook that:

1. **Mirrors badge count logic exactly** - Uses identical filters and date ranges
2. **Includes `.throwOnError()`** - Surfaces RLS/SQL errors instead of failing silently
3. **Has timeout fallback** - Prevents infinite loading after 5 seconds
4. **Always returns arrays** - Ensures loading state can resolve
5. **Uses proper column names** - Matches actual database schema (`order_status`, not `status`)

## Files Created/Modified

### `hooks/useLiveOrders.ts`
- Reliable hook for fetching live orders
- Matches badge count logic exactly
- Includes timeout protection
- Auto-refresh every 15 seconds

### `components/LiveOrdersList.tsx`
- Simple, reliable component using the hook
- Shows loading, error, and empty states
- Displays orders in a clean grid layout

### `app/test-simple/page.tsx`
- Test page to verify the fix works
- Shows both badge and list to ensure consistency

## Usage

```tsx
import LiveOrdersList from '@/components/LiveOrdersList'

// Simple usage
<LiveOrdersList venueId="your-venue-id" />

// Or use the hook directly
import { useLiveOrders } from '@/hooks/useLiveOrders'

const { data, isLoading, isError, error } = useLiveOrders(venueId)
```

## Key Features

### Reliable Query Logic
```tsx
// Matches badge count exactly
.eq('venue_id', venueId)
.in('order_status', LIVE_STATUSES)
.gte('created_at', startOfToday)
.lte('created_at', endOfToday)
.throwOnError() // Surface errors
```

### Timeout Protection
```tsx
// Never spin forever
const { data, error } = await withTimeout(queryPromise, 5000)
```

### Always Resolves
```tsx
// Always return array (even empty) so spinner resolves
setData(data ?? [])
```

## Debug Checklist

If you still see loading issues:

1. **Check Network tab** - Look for 401/403 errors on Supabase calls
2. **Add `.throwOnError()`** - This will surface RLS/SQL errors
3. **Verify filters match** - Badge and list must use identical logic
4. **Check pagination** - Ensure you're rendering page 1 (off-by-one common)
5. **Add timeout fallback** - After 3-5s, stop spinner and show empty state

## Status Values

The hook uses these live statuses that match the database schema:
- `PLACED`
- `ACCEPTED` 
- `IN_PREP`
- `READY`
- `OUT_FOR_DELIVERY`
- `SERVING`

## Database Schema

Uses correct column names from the actual schema:
- `order_status` (not `status`)
- `table_number` (not `table_label`)
- `customer_name`, `customer_phone`, etc.

## Testing

Visit `/test-simple` to test the component with a sample venue ID. The page shows both the badge count and the list to verify they use the same logic.
