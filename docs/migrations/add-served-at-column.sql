-- Add served_at column to orders table for tracking when orders are served
-- This is needed for the FOH service flow

-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'served_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE orders ADD COLUMN served_at TIMESTAMPTZ;
        RAISE NOTICE 'Added served_at column to orders table';
    ELSE
        RAISE NOTICE 'served_at column already exists in orders table';
    END IF;
END $$;
