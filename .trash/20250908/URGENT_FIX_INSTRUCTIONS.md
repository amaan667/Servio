# 🚨 URGENT FIX - Database Loading Issues

## Problem
The tables page is stuck on "Loading tables..." because of missing database columns and enum values.

## Immediate Solution
**Copy and paste this SQL script into your Supabase SQL Editor and run it:**

```sql
-- URGENT FIX: Add missing columns and enum values
-- Run this in your Supabase SQL Editor

-- 1. Add missing column
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;

-- 2. Add missing enum values
DO $$
BEGIN
    -- Add missing enum values if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'RESERVED') THEN
        ALTER TYPE table_status ADD VALUE 'RESERVED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'ORDERING') THEN
        ALTER TYPE table_status ADD VALUE 'ORDERING';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'IN_PREP') THEN
        ALTER TYPE table_status ADD VALUE 'IN_PREP';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'READY') THEN
        ALTER TYPE table_status ADD VALUE 'READY';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'SERVED') THEN
        ALTER TYPE table_status ADD VALUE 'SERVED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'AWAITING_BILL') THEN
        ALTER TYPE table_status ADD VALUE 'AWAITING_BILL';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status') AND enumlabel = 'CLOSED') THEN
        ALTER TYPE table_status ADD VALUE 'CLOSED';
    END IF;
END $$;

-- 3. Update existing data
UPDATE table_sessions 
SET status = 'FREE' 
WHERE status IS NULL;

-- 4. Ensure all tables have sessions
INSERT INTO table_sessions (venue_id, table_id, status, opened_at)
SELECT t.venue_id, t.id, 'FREE', NOW()
FROM tables t
WHERE NOT EXISTS (
    SELECT 1 FROM table_sessions ts 
    WHERE ts.table_id = t.id 
    AND ts.closed_at IS NULL
)
AND t.is_active = true;

-- 5. Recreate the view
DROP VIEW IF EXISTS tables_with_sessions;

CREATE VIEW tables_with_sessions AS
SELECT 
    t.id,
    t.venue_id,
    t.label,
    t.seat_count,
    t.is_active,
    t.qr_version,
    t.created_at as table_created_at,
    ts.id as session_id,
    ts.status,
    ts.order_id,
    ts.opened_at,
    ts.closed_at,
    ts.customer_name,
    ts.reservation_time,
    ts.reservation_duration_minutes,
    o.total_amount,
    o.customer_name as order_customer_name,
    o.order_status,
    o.payment_status,
    o.updated_at as order_updated_at
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id 
    AND ts.id = (
        SELECT id FROM table_sessions ts2 
        WHERE ts2.table_id = t.id 
        ORDER BY ts2.opened_at DESC 
        LIMIT 1
    )
LEFT JOIN orders o ON ts.order_id = o.id
WHERE t.is_active = true;

-- Grant permissions
GRANT SELECT ON tables_with_sessions TO authenticated;

-- Success message
SELECT 'Emergency fix applied successfully!' as result;
```

## Steps to Apply the Fix

1. **Go to your Supabase Dashboard**
2. **Navigate to SQL Editor**
3. **Copy the entire SQL script above**
4. **Paste it into the SQL Editor**
5. **Click "Run"**
6. **Refresh your browser**

## What This Fix Does

- ✅ Adds missing `reservation_duration_minutes` column
- ✅ Adds missing enum values: `RESERVED`, `ORDERING`, `IN_PREP`, `READY`, `SERVED`, `AWAITING_BILL`, `CLOSED`
- ✅ Updates existing data to have valid status values
- ✅ Ensures all tables have sessions
- ✅ Recreates the `tables_with_sessions` view
- ✅ Grants proper permissions

## After Running the Fix

1. **Refresh your browser** - the "Loading tables..." should disappear
2. **Try creating a reservation** - it should work without 500 errors
3. **Check the table management page** - all tables should load properly

## If You Still Have Issues

Run this diagnostic query in Supabase SQL Editor:

```sql
-- Diagnostic query
SELECT 
    'Tables count' as check_type, COUNT(*) as count FROM tables
UNION ALL
SELECT 
    'Sessions count' as check_type, COUNT(*) as count FROM table_sessions
UNION ALL
SELECT 
    'Enum values' as check_type, COUNT(*) as count FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status')
UNION ALL
SELECT 
    'View accessible' as check_type, COUNT(*) as count FROM tables_with_sessions LIMIT 1;
```

This will show you if all the components are working correctly.
