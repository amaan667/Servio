-- Migration script to fix table_number column type
-- Run this on your production database

-- First, check if table_number column exists and is TEXT type
DO $$
BEGIN
    -- Check if table_number column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'table_number' 
        AND data_type = 'text'
    ) THEN
        -- Convert table_number from TEXT to INTEGER
        -- First, drop any constraints that might reference this column
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_table_number_check;
        
        -- Convert the column type
        ALTER TABLE orders ALTER COLUMN table_number TYPE INTEGER USING table_number::INTEGER;
        
        RAISE NOTICE 'Successfully converted table_number from TEXT to INTEGER';
    ELSE
        RAISE NOTICE 'table_number column is already INTEGER or does not exist';
    END IF;
END $$;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'table_number';
