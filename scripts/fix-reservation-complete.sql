-- Complete fix for reservation feature
-- This script fixes all issues causing the "Failed to update session status" error

-- =====================================================
-- 1. ADD MISSING COLUMN
-- =====================================================

-- Add reservation_duration_minutes column to table_sessions
ALTER TABLE table_sessions 
ADD COLUMN IF NOT EXISTS reservation_duration_minutes INTEGER DEFAULT 60;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_table_sessions_reservation_duration ON table_sessions(reservation_duration_minutes);

-- =====================================================
-- 2. FIX TABLE_STATUS ENUM
-- =====================================================

-- First, check if we need to update the enum
DO $$
BEGIN
    -- Check if the enum exists and what values it has
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_status') THEN
        -- Check if RESERVED and ORDERING are missing
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'table_status')
            AND enumlabel IN ('RESERVED', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'CLOSED')
        ) THEN
            -- Add missing enum values
            ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'RESERVED';
            ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'ORDERING';
            ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'IN_PREP';
            ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'READY';
            ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'SERVED';
            ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'AWAITING_BILL';
            ALTER TYPE table_status ADD VALUE IF NOT EXISTS 'CLOSED';
            
            RAISE NOTICE 'Added missing enum values to table_status';
        ELSE
            RAISE NOTICE 'table_status enum already has required values';
        END IF;
    ELSE
        -- Create the enum with all required values
        CREATE TYPE table_status AS ENUM (
            'FREE', 
            'OCCUPIED', 
            'RESERVED', 
            'ORDERING', 
            'IN_PREP', 
            'READY', 
            'SERVED', 
            'AWAITING_BILL', 
            'CLOSED'
        );
        RAISE NOTICE 'Created table_status enum with all required values';
    END IF;
END $$;

-- =====================================================
-- 3. UPDATE EXISTING DATA
-- =====================================================

-- Update any existing rows that might have invalid status values
UPDATE table_sessions 
SET status = 'FREE' 
WHERE status IS NULL OR status NOT IN (
    'FREE', 'OCCUPIED', 'RESERVED', 'ORDERING', 
    'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'CLOSED'
);

-- =====================================================
-- 4. UPDATE VIEW
-- =====================================================

-- Drop the existing view first to avoid column name conflicts
DROP VIEW IF EXISTS tables_with_sessions;

-- Recreate the tables_with_sessions view to include all new columns
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

-- Grant access to the updated view
GRANT SELECT ON tables_with_sessions TO authenticated;

-- =====================================================
-- 5. COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'RESERVATION FEATURE FIX COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'Fixed issues:';
  RAISE NOTICE '1. Added reservation_duration_minutes column';
  RAISE NOTICE '2. Updated table_status enum with missing values';
  RAISE NOTICE '3. Updated tables_with_sessions view';
  RAISE NOTICE '4. Cleaned up existing data';
  RAISE NOTICE '=====================================================';
END $$;
