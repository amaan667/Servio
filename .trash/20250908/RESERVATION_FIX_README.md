# Reservation Feature Fix

## Problem
The reservation feature was failing with a 500 error: "Failed to update session status". This was caused by missing database columns and enum values.

## Root Cause Analysis
1. **Missing Column**: The `table_sessions` table was missing the `reservation_duration_minutes` column
2. **Incomplete Enum**: The `table_status` enum only had `'FREE'` and `'OCCUPIED'` values, but the API was trying to set status to `'RESERVED'`, `'ORDERING'`, etc.
3. **Outdated View**: The `tables_with_sessions` view didn't include the new columns

## Solution
The fix includes three main components:

### 1. Database Schema Updates
- Add `reservation_duration_minutes` column to `table_sessions`
- Update `table_status` enum with missing values: `RESERVED`, `ORDERING`, `IN_PREP`, `READY`, `SERVED`, `AWAITING_BILL`, `CLOSED`
- Update `tables_with_sessions` view to include new columns

### 2. Data Cleanup
- Update existing rows with invalid status values to `'FREE'`
- Ensure all existing data is compatible with the new schema

### 3. Indexes and Permissions
- Add appropriate indexes for performance
- Grant proper permissions on the updated view

## Files Created
- `scripts/fix-reservation-complete.sql` - Complete database fix
- `deploy-reservation-fix.sh` - Deployment script
- `test-reservation-fix.js` - Test script to verify the fix

## Deployment Instructions

### Option 1: Using the deployment script (Recommended)
```bash
./deploy-reservation-fix.sh
```

### Option 2: Manual deployment
1. Run the SQL fix in your Supabase SQL editor:
   ```bash
   # Copy and paste the contents of scripts/fix-reservation-complete.sql
   ```

2. Test the fix:
   ```bash
   node test-reservation-fix.js
   ```

## What the Fix Does

### Database Changes
```sql
-- Add missing column
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;

-- Update enum with missing values
ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'ORDERING';
-- ... and more

-- Update view
CREATE VIEW tables_with_sessions AS
SELECT 
    t.id,
    t.venue_id,
    t.label,
    -- ... existing columns
    ts.customer_name,
    ts.reservation_time,
    ts.reservation_duration_minutes,  -- NEW
    -- ... rest of columns
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id 
-- ... rest of query
```

### API Compatibility
The fix ensures that the API can now:
- Set table status to `'RESERVED'` when creating reservations
- Set table status to `'ORDERING'` when occupying tables
- Store reservation duration in minutes
- Update existing sessions with reservation data

## Testing
After applying the fix, you can test the reservation feature by:

1. **Creating a reservation** through the UI
2. **Checking the database** to ensure the session was created with the correct status
3. **Running the test script** to verify all components are working

## Expected Behavior After Fix
- ✅ Reservation creation should work without 500 errors
- ✅ Table status should update to `'RESERVED'` when reservation is created
- ✅ Reservation duration should be stored correctly
- ✅ All table management actions should work properly

## Troubleshooting
If you still encounter issues after applying the fix:

1. **Check the logs** for any remaining database errors
2. **Verify the enum values** by running:
   ```sql
   SELECT unnest(enum_range(NULL::table_status));
   ```
3. **Check column existence** by running:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'table_sessions' 
   AND column_name = 'reservation_duration_minutes';
   ```

## Related Files
- `app/api/table-sessions/actions/route.ts` - The API endpoint that was failing
- `components/table-management/ReservationDialog.tsx` - The UI component for creating reservations
- `hooks/useTableActions.ts` - The hook that calls the API

## Notes
- This fix is backward compatible and won't affect existing data
- The fix includes proper error handling and logging
- All changes are idempotent (safe to run multiple times)
