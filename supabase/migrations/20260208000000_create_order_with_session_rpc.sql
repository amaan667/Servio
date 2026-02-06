-- Migration: Create create_order_with_session RPC function
-- This RPC creates an order with table session handling

-- Drop if exists
DROP FUNCTION IF EXISTS public.create_order_with_session(
  p_venue_id UUID,
  p_table_number INTEGER,
  p_fulfillment_type TEXT,
  p_counter_label TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_items JSONB,
  p_total_amount NUMERIC,
  p_notes TEXT,
  p_order_status TEXT,
  p_payment_status TEXT,
  p_payment_method TEXT,
  p_payment_mode TEXT,
  p_source TEXT,
  p_seat_count INTEGER
);

-- Create the RPC function
CREATE OR REPLACE FUNCTION public.create_order_with_session(
  p_venue_id UUID,
  p_table_number INTEGER,
  p_fulfillment_type TEXT,
  p_counter_label TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_items JSONB,
  p_total_amount NUMERIC,
  p_notes TEXT,
  p_order_status TEXT,
  p_payment_status TEXT,
  p_payment_method TEXT,
  p_payment_mode TEXT,
  p_source TEXT,
  p_seat_count INTEGER DEFAULT 4
)
RETURNS TABLE (id UUID, order_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_table_id UUID;
  v_table_number_val INTEGER;
  v_order_number TEXT;
BEGIN
  -- Handle table for table orders
  IF p_fulfillment_type = 'table' AND p_table_number IS NOT NULL THEN
    -- Check if table exists
    SELECT id INTO v_table_id
    FROM public.tables
    WHERE venue_id = p_venue_id
      AND label = p_table_number::TEXT
      AND is_active = true;

    -- Auto-create table if doesn't exist
    IF NOT FOUND THEN
      INSERT INTO public.tables (venue_id, label, seat_count, area, is_active)
      VALUES (p_venue_id, p_table_number::TEXT, p_seat_count, NULL, true)
      RETURNING id INTO v_table_id;
    END IF;

    v_table_number_val := p_table_number;
  ELSE
    v_table_id := NULL;
    v_table_number_val := NULL;
  END IF;

  -- Generate order number
  v_order_number := 'ORD-' || LEFT(MD5(p_venue_id::TEXT || NOW()::TEXT), 8);

  -- Create the order
  INSERT INTO public.orders (
    venue_id,
    table_number,
    table_id,
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
    order_number,
    session_id
  ) VALUES (
    p_venue_id,
    v_table_number_val,
    v_table_id,
    p_fulfillment_type,
    p_counter_label,
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
    v_order_number,
    gen_random_uuid()::TEXT
  )
  RETURNING id INTO v_order_id;

  -- Return the result
  id := v_order_id;
  order_number := v_order_number;
  RETURN NEXT;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_order_with_session TO service_role, authenticated;

COMMENT ON FUNCTION public.create_order_with_session IS 'Creates an order with automatic table creation and session handling';
