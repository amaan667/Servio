-- Migration: Add fulfillment_type and counter_label columns to orders table
-- This separates counter orders from table orders properly, avoiding repurposing table_number

-- Step 1: Add new columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_type TEXT CHECK (fulfillment_type IN ('table', 'counter', 'delivery', 'pickup')),
ADD COLUMN IF NOT EXISTS counter_label TEXT;

-- Step 2: Backfill existing data based on source column
-- Set fulfillment_type based on source: 'counter' -> 'counter', 'qr' -> 'table'
UPDATE orders
SET fulfillment_type = CASE 
  WHEN source = 'counter' THEN 'counter'
  WHEN source = 'qr' THEN 'table'
  ELSE 'table' -- Default fallback
END
WHERE fulfillment_type IS NULL;

-- Step 3: Backfill counter_label for existing counter orders
-- Extract counter number from table_number for counter orders
UPDATE orders
SET counter_label = CASE
  WHEN source = 'counter' AND table_number IS NOT NULL THEN 'Counter ' || table_number::text
  WHEN source = 'counter' THEN 'Counter A' -- Default fallback
  ELSE NULL
END
WHERE counter_label IS NULL AND source = 'counter';

-- Step 4: Set table_number to NULL for counter orders (clean up repurposed field)
UPDATE orders
SET table_number = NULL
WHERE source = 'counter' AND fulfillment_type = 'counter' AND table_number IS NOT NULL;

-- Step 5: Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_orders_counter_label ON orders(counter_label) WHERE counter_label IS NOT NULL;

-- Step 6: Update create_order_with_session RPC function to accept new parameters
-- Note: This assumes the function exists. If it doesn't, you'll need to create it separately.
-- The function signature should be updated to accept:
--   p_fulfillment_type TEXT DEFAULT 'table'
--   p_counter_label TEXT DEFAULT NULL

-- Example function update (adjust based on your actual function):
/*
CREATE OR REPLACE FUNCTION create_order_with_session(
  p_venue_id UUID,
  p_table_number INTEGER DEFAULT NULL,
  p_fulfillment_type TEXT DEFAULT 'table',
  p_counter_label TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT '',
  p_customer_phone TEXT DEFAULT '',
  p_customer_email TEXT DEFAULT NULL,
  p_items JSONB,
  p_total_amount DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_order_status TEXT DEFAULT 'PLACED',
  p_payment_status TEXT DEFAULT 'UNPAID',
  p_payment_method TEXT DEFAULT 'PAY_NOW',
  p_payment_mode TEXT DEFAULT 'online',
  p_source TEXT DEFAULT 'qr',
  p_seat_count INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id UUID;
  v_table_id UUID;
  v_session_id UUID;
BEGIN
  -- Create order with new fields
  INSERT INTO orders (
    venue_id,
    table_number,
    fulfillment_type,
    counter_label,
    customer_name,
    customer_phone,
    customer_email,
    items,
    total_amount,
    notes,
    order_status,
    payment_status,
    payment_method,
    payment_mode,
    source,
    created_at,
    updated_at
  ) VALUES (
    p_venue_id,
    CASE WHEN p_fulfillment_type = 'table' THEN p_table_number ELSE NULL END,
    p_fulfillment_type,
    CASE WHEN p_fulfillment_type = 'counter' THEN p_counter_label ELSE NULL END,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_items,
    p_total_amount,
    p_notes,
    p_order_status,
    p_payment_status,
    p_payment_method,
    p_payment_mode,
    p_source,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- Handle table session creation only for table orders
  IF p_fulfillment_type = 'table' AND p_table_number IS NOT NULL THEN
    -- Find or create table
    SELECT id INTO v_table_id
    FROM tables
    WHERE venue_id = p_venue_id AND table_number = p_table_number
    LIMIT 1;

    IF v_table_id IS NULL THEN
      INSERT INTO tables (venue_id, table_number, created_at, updated_at)
      VALUES (p_venue_id, p_table_number, NOW(), NOW())
      RETURNING id INTO v_table_id;
    END IF;

    -- Create table session if it doesn't exist
    SELECT id INTO v_session_id
    FROM table_sessions
    WHERE venue_id = p_venue_id AND table_id = v_table_id AND closed_at IS NULL
    LIMIT 1;

    IF v_session_id IS NULL THEN
      INSERT INTO table_sessions (venue_id, table_id, status, opened_at, closed_at)
      VALUES (p_venue_id, v_table_id, 'FREE', NOW(), NULL)
      RETURNING id INTO v_session_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'table_id', v_table_id,
    'session_id', v_session_id,
    'table_auto_created', v_table_id IS NOT NULL
  );
END;
$$;
*/

-- Note: The RPC function update above is commented out because the actual function
-- may have a different structure. You should update it manually in Supabase SQL editor
-- or create a separate migration file for the function update.

