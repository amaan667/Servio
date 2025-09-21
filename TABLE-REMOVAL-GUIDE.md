# Table Removal Guide

This guide explains how to remove tables 15 and 67 (or any other tables) from the system and clean up their associated orders.

## Option 1: Direct SQL Execution (Recommended)

### Step 1: Run the SQL Script

Execute the following SQL in your Supabase SQL Editor:

```sql
-- Remove tables 15 and 67 from the system and clean up their orders
BEGIN;

-- Step 1: Update any active orders for tables 15 and 67 to COMPLETED status
UPDATE orders 
SET 
  order_status = 'COMPLETED',
  updated_at = NOW()
WHERE 
  table_number IN (15, 67)
  AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');

-- Step 2: Remove any table records for tables 15 and 67
DELETE FROM tables 
WHERE 
  label IN ('15', '67');

-- Step 3: Remove any table sessions for tables 15 and 67
DELETE FROM table_sessions 
WHERE 
  table_id IN (
    SELECT id FROM tables 
    WHERE label IN ('15', '67')
  );

-- Step 4: Remove any reservations for tables 15 and 67
DELETE FROM reservations 
WHERE 
  table_id IN (
    SELECT id FROM tables 
    WHERE label IN ('15', '67')
  );

COMMIT;
```

### Step 2: Verify the Removal

Run these verification queries to confirm the tables have been removed:

```sql
-- Check if tables 15 and 67 still exist
SELECT * FROM tables WHERE label IN ('15', '67');

-- Check orders for tables 15 and 67
SELECT table_number, order_status, COUNT(*) as count 
FROM orders 
WHERE table_number IN (15, 67)
GROUP BY table_number, order_status;

-- Check if any table sessions exist for tables 15 and 67
SELECT * FROM table_sessions ts
JOIN tables t ON ts.table_id = t.id
WHERE t.label IN ('15', '67');
```

## Option 2: API Endpoint

You can also use the API endpoint to remove tables programmatically:

```javascript
// POST request to /api/tables/remove
{
  "tableNumbers": [15, 67],
  "venueId": "venue-1e02af4d"
}
```

## Option 3: JavaScript Script (Requires Environment Variables)

If you have the environment variables set up, you can run:

```bash
node remove-tables.js 15 67
```

## For Different Table Numbers

To remove different tables, simply replace the numbers in the SQL script:

1. Change `IN (15, 67)` to `IN (YOUR_TABLE_NUMBERS)`
2. Change `IN ('15', '67')` to `IN ('YOUR_TABLE_NUMBERS')`

Example for tables 23, 45, and 78:
```sql
WHERE table_number IN (23, 45, 78)
WHERE label IN ('23', '45', '78')
```

## What This Script Does

1. **Updates Active Orders**: Changes any active orders for the specified tables to "COMPLETED" status
2. **Removes Table Records**: Deletes the table records from the `tables` table
3. **Cleans Up Sessions**: Removes any active table sessions
4. **Removes Reservations**: Deletes any reservations for those tables

## Safety Features

- Orders are marked as "COMPLETED" rather than deleted to preserve order history
- All operations are wrapped in a transaction for safety
- Verification queries help confirm the removal was successful

## Files Created

- `remove-tables.sql` - Main SQL script for removing tables 15 and 67
- `remove-tables-template.sql` - Template for removing any tables
- `remove-tables.js` - JavaScript utility for programmatic removal
- `remove-tables-15-67-direct.js` - Direct script for tables 15 and 67
- `app/api/tables/remove/route.ts` - API endpoint for table removal
