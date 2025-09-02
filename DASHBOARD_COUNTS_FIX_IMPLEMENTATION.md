# Dashboard Counts Fix Implementation

## Overview
This document outlines the comprehensive fix implemented to resolve the dashboard badge flickering and inconsistent "Active tables" count issues.

## Problems Solved
1. **Badge Flickering**: Badges were computed from client-side tab data, starting at 0 then jumping to correct values
2. **Inconsistent "Active Tables" Count**: Derived from filtered lists or stale cache, not updating reliably
3. **Multiple Data Sources**: Different components were calculating counts using different logic

## Solution Implemented

### 1. New Authoritative SQL Function
- **File**: `scripts/create-tab-counts-function.sql`
- **Function**: `public.dashboard_counts(p_venue_id, p_tz, p_live_window_mins)`
- **Returns**: All dashboard counts in one call:
  - `live_count`: Orders within 30-min window with active statuses
  - `earlier_today_count`: Today's orders not in live window
  - `history_count`: SERVED orders before today
  - `today_orders_count`: Total orders today
  - `active_tables_count`: Distinct tables with live orders

### 2. Server-Side Count Fetching
- **File**: `app/dashboard/[venueId]/page.tsx`
- **Change**: Fetches counts server-side using new RPC function
- **Benefit**: No more 0→N flicker - badges render with correct values immediately

### 3. Updated Client Component
- **File**: `app/dashboard/[venueId]/page.client.tsx`
- **Changes**:
  - Accepts `initialCounts` and `venueTz` props
  - Uses authoritative counts for all badge displays
  - Implements realtime count updates via `refreshCounts()`
  - Removes client-side count calculations

### 4. Updated Hooks
- **File**: `hooks/use-tab-counts.ts`
- **Changes**: Updated to use new `dashboard_counts` RPC and include new count fields

### 5. Realtime Configuration
- **File**: `scripts/enable-realtime.sql`
- **Purpose**: Ensures orders table is in realtime publication for immediate updates

## Key Benefits

1. **No More Flickering**: Badges render with correct values from server
2. **Consistent Logic**: All counts use the same 30-minute window and status rules
3. **Immediate Updates**: "Active tables" shows correct count instantly when orders are placed
4. **Single Source of Truth**: One RPC function provides all counts
5. **Timezone Aware**: Properly handles venue timezone for day boundaries

## How It Works

1. **Server Render**: Page loads with correct counts from RPC function
2. **Client Hydration**: Client receives counts and displays them immediately
3. **Realtime Updates**: Any order change triggers count refresh via RPC
4. **Consistent Rules**: Live orders = 30-min window + active statuses, same for active tables

## Database Schema Requirements

- `orders.venue_id`: Must be set for venue filtering
- `orders.table_id`: Must be set for active tables count (not null)
- `orders.order_status`: Must use consistent status values
- `orders.created_at`: Must be in UTC for timezone calculations

## Testing

1. **Place New Order**: Should immediately update "Active tables" count
2. **Tab Navigation**: Badges should be consistent across all tabs
3. **Realtime Updates**: Counts should update within seconds of order changes
4. **Timezone Handling**: Day boundaries should respect venue timezone

## Files Modified

- `scripts/create-tab-counts-function.sql` - New RPC function
- `app/dashboard/[venueId]/page.tsx` - Server-side count fetching
- `app/dashboard/[venueId]/page.client.tsx` - Client-side count handling
- `hooks/use-tab-counts.ts` - Updated hook interface
- `scripts/enable-realtime.sql` - Realtime configuration

## Next Steps

1. Run the SQL scripts to create the new function and enable realtime
2. Deploy the updated components
3. Test with real orders to verify counts update correctly
4. Monitor for any remaining inconsistencies

## Notes

- The fix maintains backward compatibility with existing order statuses
- Timezone is hardcoded to 'Europe/London' but can be made configurable
- The 30-minute live window is configurable via the RPC parameter
- All existing functionality is preserved while fixing the core issues
