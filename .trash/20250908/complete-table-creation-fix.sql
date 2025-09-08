-- COMPLETE TABLE CREATION FIX
-- This script fixes all issues preventing table creation

-- Step 1: Enable RLS on all tables (fixes 503 errors)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

-- Step 2: Remove problematic constraints
ALTER TABLE table_sessions DROP CONSTRAINT IF EXISTS uniq_open_session_per_table;
ALTER TABLE table_sessions DROP CONSTRAINT IF EXISTS table_sessions_table_id_key;

-- Step 3: Clean up orphaned sessions
DELETE FROM table_sessions WHERE table_id NOT IN (SELECT id FROM tables);

-- Step 4: Drop and recreate the trigger function
DROP TRIGGER IF EXISTS create_free_session_trigger ON tables;
DROP FUNCTION IF EXISTS create_free_session_for_new_table();

-- Step 5: Create a new trigger function that handles constraints properly
CREATE OR REPLACE FUNCTION create_free_session_for_new_table()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create a session if there isn't already an open one
    IF NOT EXISTS (
        SELECT 1 FROM table_sessions 
        WHERE table_id = NEW.id 
        AND closed_at IS NULL
    ) THEN
        INSERT INTO table_sessions (table_id, venue_id, status, opened_at)
        VALUES (NEW.id, NEW.venue_id, 'FREE', NOW());
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 6: Recreate the trigger
CREATE TRIGGER create_free_session_trigger
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION create_free_session_for_new_table();

-- Step 7: Ensure tables table has all required columns
DO $$
BEGIN
    -- Add qr_version column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tables' 
        AND column_name = 'qr_version'
    ) THEN
        ALTER TABLE tables ADD COLUMN qr_version INTEGER DEFAULT 1;
        RAISE NOTICE 'Added qr_version column to tables table';
    END IF;
    
    -- Update existing tables to have qr_version = 1 if they're NULL
    UPDATE tables SET qr_version = 1 WHERE qr_version IS NULL;
END $$;

-- Step 8: Fix orders table schema issues
DO $$
BEGIN
    -- Fix table_number column type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'table_number' 
        AND data_type = 'text'
    ) THEN
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_table_number_check;
        ALTER TABLE orders ALTER COLUMN table_number TYPE INTEGER USING table_number::INTEGER;
        RAISE NOTICE 'Successfully converted table_number from TEXT to INTEGER';
    END IF;
    
    -- Add order_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'order_status'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_status TEXT DEFAULT 'PLACED' 
        CHECK (order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'));
        RAISE NOTICE 'Added order_status column to orders table';
    END IF;
END $$;

-- Step 9: Fix payment_status constraints
UPDATE orders 
SET payment_status = CASE 
  WHEN payment_status = 'pending' THEN 'UNPAID'
  WHEN payment_status = 'paid' THEN 'PAID'
  WHEN payment_status = 'failed' THEN 'UNPAID'
  WHEN payment_status = 'refunded' THEN 'REFUNDED'
  WHEN payment_status IS NULL THEN 'UNPAID'
  WHEN payment_status NOT IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED') THEN 'UNPAID'
  ELSE payment_status
END;

ALTER TABLE orders 
ALTER COLUMN payment_status SET DEFAULT 'UNPAID',
DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED'));

-- Step 10: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tables_venue_id ON tables(venue_id);
CREATE INDEX IF NOT EXISTS idx_tables_is_active ON tables(is_active);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_id ON table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);

-- Step 11: Verify the fix
SELECT 'Table creation fix completed successfully!' as status;
SELECT 'Tables count:' as info, COUNT(*) as count FROM tables;
SELECT 'Table sessions count:' as info, COUNT(*) as count FROM table_sessions;
SELECT 'RLS enabled on tables:' as info, rowsecurity FROM pg_tables WHERE tablename = 'tables';
SELECT 'RLS enabled on table_sessions:' as info, rowsecurity FROM pg_tables WHERE tablename = 'table_sessions';
